import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

const silenceVolume = -30; // in decibels
const silenceDuration = 2.0; // in seconds
const audioPath = path.join(process.cwd(), "audio.mp3");

function getDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration);
      }
    });
  });
}

let segments = [];
// 1800 seconds = 30 minutes
let splitTimes = [
  1800, 3600, 5400, 7200, 9000, 10800, 12600, 14400, 16200, 18000,
];
let currentSplitTime = 0;
let silenceStart;
let possibleSplit;

const silenceDetect = ffmpeg(audioPath)
  .outputOptions([
    "-af",
    `silencedetect=noise=${silenceVolume}dB:d=${silenceDuration}`,
    "-f",
    "null",
  ])
  .output("pipe:1")
  .on("start", () => {
    console.log("Starting silence detection");
  })
  .on("stderr", (stderrLine) => {
    const silenceStartRegex = /silence_start: (\d+(\.\d+)?)/;
    const silenceEndRegex = /silence_end: (\d+\.\d+)/;

    const startMatch = silenceStartRegex.exec(stderrLine);
    const endMatch = silenceEndRegex.exec(stderrLine);

    if (startMatch) {
      silenceStart = parseFloat(startMatch[1]);
    } else if (endMatch) {
      const silenceEnd = parseFloat(endMatch[1]);
      // If this silence occurs after the current split time, save it as a definite split point and move on to the next split time
      if (silenceStart > splitTimes[currentSplitTime]) {
        const silenceMid = (silenceStart + silenceEnd) / 2;
        segments.push(silenceMid);
        currentSplitTime++;
      }
    }
  })
  .on("end", () => {
    console.log("Silence detection complete.");
    splitAudio(audioPath, segments);
  });

getDuration(audioPath).then((duration) => {
  if (duration > 1800) silenceDetect.run();
});

function splitAudio(audioPath, segments) {
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  let start = 0;
  segments.forEach((segment, index) => {
    const cutStart = start;
    const cutEnd = segment;
    const outputFileName = `part-${index + 1}.mp3`;
    const outputPath = path.join(outputDir, outputFileName);
    ffmpeg(audioPath)
      .noVideo()
      .audioFrequency(16000)
      .audioBitrate(48)
      .audioChannels(1)
      .audioCodec("libmp3lame")
      .format("mp3")
      .setStartTime(cutStart)
      .setDuration(cutEnd - cutStart)
      .output(outputPath)
      .on("start", () => {
        console.log(`Starting to split segment ${index + 1}`);
      })
      .on("end", () => {
        console.log(`Finished splitting segment ${index + 1}`);
      })
      .on("error", (err) => {
        console.log(
          `Error occurred while splitting segment ${index + 1}: ${err.message}`
        );
      })
      .run();
    start = cutEnd;
  });
  const outputFileName = `part-${segments.length + 1}.mp3`;
  const outputPath = path.join(outputDir, outputFileName);
  ffmpeg(audioPath)
    .setStartTime(start)
    .output(outputPath)
    .on("start", () => {
      console.log(`Starting to split the last segment`);
    })
    .on("end", () => {
      console.log(`Finished splitting the last segment`);
    })
    .on("error", (err) => {
      console.log(
        `Error occurred while splitting the last segment: ${err.message}`
      );
    })
    .run();
}
