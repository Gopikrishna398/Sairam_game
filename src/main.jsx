import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App
      birdImage="/assets/sairamface.png"
      obstacleImage="/assets/obstacle.svg"
      obstacleTopImage="/assets/polesairam3.png"
      obstacleBottomImage="/assets/pole sairam 4.png"
      collisionSound="/assets/collision.mp3"
    />
  </React.StrictMode>
);
