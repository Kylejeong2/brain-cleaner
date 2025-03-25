require('dotenv').config;
console.log(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.AWS_S3_BUCKET_NAME);
const Creatomate = require('creatomate');
// Replace the fetch import with this dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const {
    Polly,
} = require('@aws-sdk/client-polly');

const {
    Upload,
} = require('@aws-sdk/lib-storage');

const {
    S3,
    GetObjectCommand
} = require('@aws-sdk/client-s3');

const {
    getSignedUrl
} = require('@aws-sdk/s3-request-presigner');

// Test script - a fun example about space exploration
const TEST_SCRIPT_LOWER = `Yeeked rn off of 11 yerks feeling super. Feeling like chief yeef.`;
const TEST_SCRIPT = TEST_SCRIPT_LOWER.toUpperCase();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
    throw new Error('AWS credentials and S3 bucket name not found in environment variables. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME');
}

const polly = new Polly({
    region: 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const s3 = new S3({
    region: 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

async function textToSpeech(text, i) {
    // Text to speech
    const speech = await polly.synthesizeSpeech({
        OutputFormat: 'mp3',
        Text: text,
        VoiceId: 'Matthew',
    });

    // Get the marks at which words are spoken
    const speechMarks = await polly.synthesizeSpeech({
        OutputFormat: 'json',
        Text: text,
        VoiceId: 'Matthew',
        SpeechMarkTypes: ['word'],
    });

    // Convert the AudioStream buffer to marks
    let marks = [];
    if (speechMarks.AudioStream) {
        const chunks = [];
        for await (const chunk of speechMarks.AudioStream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        marks = buffer
            .toString('utf8')
            .split('\n')
            .filter(mark => mark.length > 0)
            .map(mark => JSON.parse(mark));
    }

    // Upload the audio file to S3 and make it publicly accessible
    const upload = await new Upload({
        client: s3,
        params: {
            Body: speech.AudioStream,
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `speech/part${i}.mp3`,
            ContentType: 'audio/mpeg',
        },
    }).done();

    // Generate a pre-signed URL that expires in 1 hour
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `speech/part${i}.mp3`,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return { text, uploadLocation: presignedUrl, textMarks: marks };
}

const apiKey = process.env.CREATOMATE_API_KEY;
if (!apiKey) {
    console.error('\n\n⚠️  Please set the CREATOMATE_API_KEY environment variable');
    process.exit(1);
}

// Function to split a script into sentences first, then into word pairs
function splitIntoWordPairs(script) {
    // First split into sentences
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [];
    const trimmedSentences = sentences.map(sentence => sentence.trim());

    // Now split each sentence into words and then pair them
    const wordPairs = [];
    for (const sentence of trimmedSentences) {
        const words = sentence.split(/\s+/);

        // Group words into pairs (or single if it's the last odd one)
        for (let i = 0; i < words.length; i += 2) {
            if (i + 1 < words.length) {
                // We have a pair
                wordPairs.push(`${words[i]} ${words[i + 1]}`);
            } else {
                // Last word is alone
                wordPairs.push(words[i]);
            }
        }
    }

    return wordPairs;
}

// Helper function to trim punctuation from words
function trimPunctuation(word) {
    return word.replace(/[^\w\s]/g, ''); // Remove non-alphanumeric characters
}

const client = new Creatomate.Client(apiKey);
const wordPairs = splitIntoWordPairs(TEST_SCRIPT);

async function run() {
    console.log('Converting text to speech using AWS Polly...');

    // Convert the entire script to speech first (for smooth audio)
    const fullSpeech = await textToSpeech(TEST_SCRIPT, 'full');

    // Create word pair segments with their timing information
    const wordPairSegments = [];
    let currentPairIndex = 0;
    const marks = fullSpeech.textMarks;

    // Process all word marks to determine timing for each word pair
    if (marks.length > 0) {
        for (let i = 0; i < wordPairs.length; i++) {
            const words = wordPairs[i].split(/\s+/);
            const wordCount = words.length;

            // Find start and end times for this word pair
            let startMark = null;
            let endMark = null;

            // Look for the starting word
            for (let j = currentPairIndex; j < marks.length; j++) {
                if (trimPunctuation(marks[j].value.toUpperCase()) === trimPunctuation(words[0].toUpperCase())) {
                    startMark = marks[j];
                    currentPairIndex = j;
                    break;
                }
            }

            // Look for the ending word (either second word in pair or single word)
            if (wordCount === 2) {
                for (let j = currentPairIndex + 1; j < marks.length; j++) {
                    if (trimPunctuation(marks[j].value.toUpperCase()) === trimPunctuation(words[1].toUpperCase())) {
                        endMark = marks[j];
                        currentPairIndex = j + 1; // Move past this word
                        break;
                    }
                }
            } else {
                // Single word, end time is the end of this word
                endMark = startMark;
                currentPairIndex += 1;
            }

            if (startMark && endMark) {
                // Calculate duration for this word pair
                const startTime = startMark.time / 1000; // Convert to seconds
                const endTime = (endMark.time + endMark.duration) / 1000; // End time including the duration of the word

                wordPairSegments.push({
                    text: wordPairs[i],
                    startTime,
                    endTime,
                    duration: endTime - startTime
                });
            } else {
                console.error(`Error: Could not find marks for word pair "${wordPairs[i]}"`);
            }
        }
    }

    // Validate all timing data
    const hasTrimIssues = wordPairSegments.some(segment => {
        return segment.duration <= 0 || segment.duration > 10; // Assume anything over 10 seconds for a word pair is an error
    });

    if (hasTrimIssues) {
        console.error('Error: Invalid timing values detected. Aborting render to save credits.');
        throw new Error('Invalid timing values. Video duration would be incorrect.');
    }

    // Ensure minimum duration for the last word pair
    if (wordPairSegments.length > 0) {
        const lastPair = wordPairSegments[wordPairSegments.length - 1];
        if (lastPair.duration < 0.5) {  // If duration is less than 0.5 seconds
            const minDuration = 0.7;  // Set a minimum duration
            lastPair.duration = minDuration;
            lastPair.endTime = lastPair.startTime + minDuration;
        }
    }

    // Calculate total video duration - last word pair end time
    const totalDuration = wordPairSegments.length > 0
        ? wordPairSegments[wordPairSegments.length - 1].endTime + 0.5 // Add 0.5 seconds buffer
        : 0;

    // Log all timing info for debugging
    wordPairSegments.forEach((segment, index) => {
        console.log(`Word pair ${index + 1}: "${segment.text}" - Start: ${segment.startTime}s, End: ${segment.endTime}s, Duration: ${segment.duration}s`);
    });
    console.log(`Total video duration: ${totalDuration}s`);

    console.log('Creating video with Creatomate...');

    // Create the video with continuous gameplay and changing text overlays
    const source = new Creatomate.Source({
        outputFormat: 'mp4',
        width: 720,
        height: 1280,
        duration: totalDuration,

        elements: [
            // Background gameplay video (continuous)
            new Creatomate.Video({
                source: 'https://brainclnr.s3.us-east-2.amazonaws.com/MCgameplay.mp4',
                track: 1, // Place on track 1 (background)
                duration: totalDuration, // Make it last for the entire video
                // If the gameplay is shorter than the speech, set it to loop
                loop: true
            }),

            new Creatomate.Audio({
                source: 'https://brainclnr.s3.us-east-2.amazonaws.com/v%C3%B8j%2C+narvent%2C+.diedlonely+-+memory+reboot+(ambient+remix)-yt.savetube.me.mp3', // Replace with your music URL
                track: 2,
                time: 0,
                duration: totalDuration,
                loop: true  // Ensures the music loops if it’s shorter than the video
            }),

            // Add the full audio track
            new Creatomate.Audio({
                source: fullSpeech.uploadLocation,
                track: 2, // Place on track 2 (audio)
            }),

        // Create a text element for each word pair
            ...wordPairSegments.map((segment, index) => (
                new Creatomate.Text({
                    track: 3, // Place all text on track 3 (foreground)
                    time: segment.startTime, // Start showing this text at the calculated start time
                    duration: segment.duration, // Show for the calculated duration
                    width: '70%',
                    height: '30%',
                    fillColor: '#ffffff',
                    fontWeight: 800,
                    fontFamily: 'Rubik',
                    fontSize: '8vw',
                    fontStyle: 'italic',
                    xAlignment: '50%',
                    yAlignment: '50%',
                    text: segment.text,
                    backgroundColor: 'transparent',
                    strokeColor: '#000000',
                    strokeWidth: '2',
                    borderRadius: '10',
                    // Add keyframes to animate the x position (horizontal slide)
                    keyframes: {
                        // Normalized time values from 0 (start) to 1 (end) of the element's duration
                        x: [
                            { time: 0, value: '-100%' }, // Start off-screen left
                            { time: 0.2, value: '50%' },   // Slide to center by 20% of duration
                            { time: 0.8, value: '50%' },   // Stay centered until 80% of duration
                            { time: 1, value: '150%' }     // Slide off-screen right at end
                        ]
                    }
                })
            ))
        ],
    });

    // Render the video
    const renders = await client.render({ source });

    console.log('Completed:', renders);
}

// If this file is run directly (not imported), execute the run function
if (require.main === module) {
    console.log('Starting video generation with test script...');
    console.log('Script split into word pairs:', wordPairs);
    run()
        .catch(error => console.error('Error during execution:', error));
}

async function generateVideo(script) {
    const client = new Creatomate.Client(process.env.CREATOMATE_API_KEY);
    if (!process.env.CREATOMATE_API_KEY) {
        throw new Error('Creatomate API key not found in environment variables');
    }

    const wordPairs = splitIntoWordPairs(script);
    console.log('Converting text to speech using AWS Polly...');

    // Convert the entire script to speech first (for smooth audio)
    const fullSpeech = await textToSpeech(script, 'full');

    // Create word pair segments with their timing information
    const wordPairSegments = [];
    let currentPairIndex = 0;
    const marks = fullSpeech.textMarks;

    // Process all word marks to determine timing for each word pair
    if (marks.length > 0) {
        for (let i = 0; i < wordPairs.length; i++) {
            const words = wordPairs[i].split(/\s+/);
            const wordCount = words.length;

            // Find start and end times for this word pair
            let startMark = null;
            let endMark = null;

            // Look for the starting word
            for (let j = currentPairIndex; j < marks.length; j++) {
                if (trimPunctuation(marks[j].value.toUpperCase()) === trimPunctuation(words[0].toUpperCase())) {
                    startMark = marks[j];
                    currentPairIndex = j;
                    break;
                }
            }

            // Look for the ending word (either second word in pair or single word)
            if (wordCount === 2) {
                for (let j = currentPairIndex + 1; j < marks.length; j++) {
                    if (trimPunctuation(marks[j].value.toUpperCase()) === trimPunctuation(words[1].toUpperCase())) {
                        endMark = marks[j];
                        currentPairIndex = j + 1; // Move past this word
                        break;
                    }
                }
            } else {
                // Single word, end time is the end of this word
                endMark = startMark;
                currentPairIndex += 1;
            }

            if (startMark && endMark) {
                // Calculate duration for this word pair
                const startTime = startMark.time / 1000; // Convert to seconds
                const endTime = (endMark.time + endMark.duration) / 1000; // End time including the duration of the word

                wordPairSegments.push({
                    text: wordPairs[i],
                    startTime,
                    endTime,
                    duration: endTime - startTime
                });
            } else {
                console.error(`Error: Could not find marks for word pair "${wordPairs[i]}"`);
            }
        }
    }

    // Calculate total video duration - last word pair end time
    const totalDuration = wordPairSegments.length > 0
        ? wordPairSegments[wordPairSegments.length - 1].endTime + 0.5 // Add 0.5 seconds buffer
        : 0;

    console.log('Creating video with Creatomate...');

    // Create the video with continuous gameplay and changing text overlays
    const source = new Creatomate.Source({
        outputFormat: 'mp4',
        width: 720,
        height: 1280,
        duration: totalDuration,

        elements: [
            // Background gameplay video (continuous)
            new Creatomate.Video({
                source: 'https://brainclnr.s3.us-east-2.amazonaws.com/MCgameplay.mp4',
                track: 1, // Place on track 1 (background)
                duration: totalDuration, // Make it last for the entire video
                // If the gameplay is shorter than the speech, set it to loop
                loop: true
            }),

            new Creatomate.Audio({
                source: 'https://brainclnr.s3.us-east-2.amazonaws.com/v%C3%B8j%2C+narvent%2C+.diedlonely+-+memory+reboot+(ambient+remix)-yt.savetube.me.mp3', // Replace with your music URL
                track: 2,
                time: 0,
                duration: totalDuration,
                loop: true  // Ensures the music loops if it’s shorter than the video
            }),


            // Add the full audio track
            new Creatomate.Audio({
                source: fullSpeech.uploadLocation,
                track: 2, // Place on track 2 (audio)
            }),

            // Create a text element for each word pair
            ...wordPairSegments.map((segment, index) => (
                new Creatomate.Text({
                    track: 3, // Place all text on track 3 (foreground)
                    time: segment.startTime, // Start showing this text at the calculated start time
                    duration: segment.duration, // Show for the calculated duration
                    width: '70%',
                    height: '30%',
                    fillColor: '#ffffff',
                    fontWeight: 800,
                    fontFamily: 'Rubik',
                    fontSize: '8vw',
                    fontStyle: 'italic',
                    xAlignment: '50%',
                    yAlignment: '50%',
                    text: segment.text,
                    backgroundColor: 'transparent',
                    strokeColor: '#000000',
                    strokeWidth: '2',
                    borderRadius: '10',
                })
            )),
        ],
    });

    // Render the video
    const renders = await client.render({ source });

    if (renders[0].status === 'failed') {
        throw new Error(`Video generation failed: ${renders[0].errorMessage}`);
    }

    // Download the video from Creatomate
    console.log('Downloading video from Creatomate...');
    const videoResponse = await fetch(renders[0].url);

    if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const videoBuffer = await videoResponse.buffer();

    // Generate a unique filename using timestamp
    const timestamp = new Date().getTime();
    const videoKey = `videos/video_${timestamp}.mp4`;

    // Upload the video to S3
    console.log('Uploading video to AWS S3...');
    const uploadResult = await new Upload({
        client: s3,
        params: {
            Body: videoBuffer,
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: videoKey,
            ContentType: 'video/mp4',
        },
    }).done();
    console.log("Finished Uploading");

    // Generate a pre-signed URL for the video in S3 (valid for 24 hours)
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: videoKey,
    });
    const s3Url = await getSignedUrl(s3, command, { expiresIn: 86400 });

    return {
        creatomateUrl: renders[0].url,
        s3Url: s3Url,
        s3Key: videoKey,
        status: renders[0].status,
        id: renders[0].id
    };
}

// Export the main function
exports.generateVideo = generateVideo;

// If this file is run directly, use the test script
if (require.main === module) {
    console.log('Starting video generation with test script...');
    generateVideo(TEST_SCRIPT)
        .then(result => console.log('Completed:', result))
        .catch(error => console.error('Error during execution:', error));
}