// ==UserScript==
// @name         Pipstamp
// @namespace    https://github.com/Ponkhy/Pipstamp
// @version      1.0.0
// @description  Provides the option to insert a username by clicking on it of a YouTube video or livestream
// @author       Ponkhy
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @downloadURL  https://github.com/Ponkhy/Pipstamp/raw/main/pipstamp.user.js
// @updateURL    https://github.com/Ponkhy/Pipstamp/raw/main/pipstamp.user.js
// ==/UserScript==

(function () {
  "use strict";

  function formatTime(time) {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    return `${hours < 10 ? "0" : ""}${hours}:${
      minutes < 10 ? "0" : ""
    }${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  let videoId;

  const database = indexedDB.open("Pipstamp", 1);

  database.onupgradeneeded = function (event) {
    const db = event.target.result;
    const store = db.createObjectStore("timestamps", { autoIncrement: true });

    store.createIndex("videoId", "videoId", { unique: false });

    db.close();
  };

  function removeTimestamp(key) {
    const databaseRM = indexedDB.open("Pipstamp");

    databaseRM.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(["timestamps"], "readwrite");
      const store = transaction.objectStore("timestamps");

      store.delete(key);

      console.log(`Deleted timestamp with key ${key}`);

      db.close();
    };
  }

  function addTimestampMarker(time, key) {
    const video = document.querySelector("video");
    if (!video) return;

    const videoTimeline = document.querySelector(".ytp-progress-bar-container");
    if (!videoTimeline) return;

    const videoDuration = video.duration;

    const div = document.createElement("div");
    div.classList.add("timestampMarker");
    div.style.left = `${(time / videoDuration) * 100}%`;
    div.style.zIndex = 99;
    div.style.position = "absolute";
    div.style.width = "2px";
    div.style.height = "100%";
    div.style.backgroundColor = "pink";

    div.addEventListener("click", () => {
      removeTimestamp(key);
      div.remove();
    });

    videoTimeline.appendChild(div);
  }

  function getCurrentTimestamp() {
    const video = document.querySelector("video");

    if (video) {
      const currentTime = video.currentTime;
      const formattedTime = formatTime(currentTime);

      const databaseRW = indexedDB.open("Pipstamp");

      databaseRW.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(["timestamps"], "readwrite");
        const store = transaction.objectStore("timestamps");
        const timestamp = {
          time: currentTime,
          formattedTime: formattedTime,
          videoId: videoId,
        };

        const request = store.add(timestamp);

        request.onsuccess = function(event) {
            const key = event.target.result;

            addTimestampMarker(currentTime, key);

            console.log(`Added timestamp at ${formattedTime} with key ${key}`);

            db.close();
        };
      };
    } else {
      console.log("No video found");
    }
  }

  function addTimestampButton() {
    const fullscreenButton = document.querySelector(
      'button[data-tooltip-target-id="ytp-autonav-toggle-button"]'
    );
    if (!fullscreenButton) return;

    const rightControls = document.querySelector(".ytp-right-controls");
    if (!rightControls) return;

    const button = document.createElement("button");
    button.setAttribute("id", "timestampButton");
    button.setAttribute("aria-label", "Log current timestamp");
    button.setAttribute("title", "Log current timestamp");
    button.classList.add("ytp-button");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "#ffffff");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = `<circle cx="18" cy="18" r="10"></circle><polyline points="18 10 18 18 24 20"></polyline>`;

    svg.style.position = "relative";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.top = "50%";
    svg.style.left = "50%";
    svg.style.transform = "translate(-50%, -50%)";

    button.appendChild(svg);

    button.addEventListener("click", getCurrentTimestamp);

    rightControls.insertBefore(button, fullscreenButton);
  }

  function loadTimestamps(videoId) {
    document.querySelectorAll(".timestampMarker").forEach((i) => i.remove());

    const databaseRO = indexedDB.open("Pipstamp");

    databaseRO.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(["timestamps"], "readonly");
      const store = transaction.objectStore("timestamps");
      const index = store.index("videoId");
      const range = IDBKeyRange.only(videoId);
      const request = index.openCursor(range);

      request.onsuccess = function (event) {
        const cursor = event.target.result;

        if (cursor) {
          console.log("Loaded timestamp:", cursor.value);

          addTimestampMarker(cursor.value.time, cursor.primaryKey);

          cursor.continue();
        }
      };
    };
  }

  document.addEventListener("yt-navigate-finish", () => {
    videoId = window.location.search.split("v=")[1];

    const timestampButton = document.querySelector("#timestampButton");
    if (!timestampButton) addTimestampButton();

    loadTimestamps(videoId);
  });
})();
