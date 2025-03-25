const fetch = require("node-fetch");
require("dotenv").config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Function to extract text from Chunkr API response
// const extractTextFromChunkr = (chunkrData) => {
//     let extractedText = "";
//     chunkrData.output.chunks.forEach(chunk => {
//         chunk.segments.forEach(segment => {
//             extractedText += segment.text + " "; // Combine all text
//         });
//     });
//     return extractedText.trim();
// };

// function2: 

const extractTextFromChunkr = (chunkrData) => {
    if (!chunkrData || !chunkrData.output || !chunkrData.output.chunks) {
      throw new Error('Invalid Chunkr data structure');
    }
  
    // Collect only the markdown or content from each segment
    const segments = chunkrData.output.chunks.flatMap(chunk => {
      return (chunk.segments || []).map(segment => {
        return segment.markdown ? segment.markdown : segment.content ? segment.content : '';
      });
    }).filter(text => text.trim() !== '');

    let combinedText = segments.join("\n\n").split(/\s+/);
    // Extract first 4000 words of text from Chunkr's response
    const max_script_length = 4500;
    if (combinedText.length > max_script_length) {
      combinedText = combinedText.slice(0, max_script_length).join(" ");
    }
  
    // Return a JSON object with the extracted segments as an array,
    // and also a combined string if needed.
    return {
      segments: segments,
      combinedText: combinedText
    };
  };
  

// Function to generate a video script using OpenAI
exports.generateVideoScript = async (chunkrData) => {
    try {
       
        const extractedText = extractTextFromChunkr(chunkrData)
        // const extractedText = chunkrData;

        // Define OpenAI prompt for script generation
        const prompt = `
          You are an AI scriptwriter. Convert the following text into a natural, engaging video script that is meant to be spoken aloud. 
          Do not include any meta information such as timestamps, narrator labels, stage directions, sound effects, or visual cues—only the spoken narration. 
          Maintain technical accuracy while keeping the script easy to understand and conversational for a general audience. 
          Limit the script to around 1 minute (~700 words max).
          Format your output as plain text. Include only the text of the script, and just the text. Nothing else.

          Here is the input text:
          ${extractedText.combinedText}
        `;

        // Send request to OpenAI
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: prompt }]
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`OpenAI API Error: ${JSON.stringify(data)}`);

        return data.choices[0].message.content; // Return script as text
    } catch (error) {
        console.error("Error generating video script:", error);
        throw error;
    }
};
