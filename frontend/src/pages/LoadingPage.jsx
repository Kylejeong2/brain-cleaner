import React from "react";
import { Link } from "react-router-dom";
import "./LoadingPage.css";
import "../../assets/digital-numbers-webfont/style.css";

const LoadingPage = () => {
  return (
    <div className="home-container">
      <div className="home-content">
        <h1
          style={{
            fontFamily: "'Digital Numbers Regular'",
            fontWeight: "normal",
            fontSize: "42px",
          }}
        >
          Welcome
        </h1>
        <p class="subheading">
          convert your pdfs to <span class="crossed-out">brainrot</span>{" "}
          brain.clnr
        </p>
        <div className="cta-buttons">
          <Link to="/login" className="get-started-btn">
            start
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
