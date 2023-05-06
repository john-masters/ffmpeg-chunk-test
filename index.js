import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

console.log("Program start");

const audioPath = path.join(process.cwd(), "audio.mp3");

let segments = [];
let currentSegmentStart = 0;

const letTheChunkingBegin = ffmpeg(audioPath)
  .outputOptions([
    "-af",
    // Adjust 'noise' value to tweak silence threshold
    "silencedetect=noise=-30dB:d=5.0",
    "-f",
    "null",
  ])
  .output("pipe:1")
  .on("start", () => {
    console.log("Starting silence detection");
  })
  .on("stderr", (stderrLine) => {
    // Extract start and end times of silence
    const silenceStartRegex = /silence_start: (\d+\.\d+)/;
    const silenceEndRegex = /silence_end: (\d+\.\d+)/;

    const startMatch = silenceStartRegex.exec(stderrLine);
    const endMatch = silenceEndRegex.exec(stderrLine);

    if (startMatch) {
      const silenceStart = parseFloat(startMatch[1]);
      segments.push({ start: currentSegmentStart, end: silenceStart });
      console.log(`Silence detected at ${silenceStart}s`);
    }

    if (endMatch) {
      const silenceEnd = parseFloat(endMatch[1]);
      currentSegmentStart = silenceEnd;
      console.log(`Silence ended at ${silenceEnd}s`);
    }
  })
  .on("end", () => {
    console.log("Silence detection complete.");
    splitAudio();
  });

// Execute the command
letTheChunkingBegin.exec();

function splitAudio() {
  segments.forEach((segment, index) => {
    const outputPath = path.join(
      process.cwd(),
      "output",
      `output_${index}.mp3`
    );

    ffmpeg(audioPath)
      .setStartTime(segment.start)
      .setDuration(segment.end - segment.start)
      .output(outputPath)
      .on("start", () => {
        console.log(`Start splitting segment ${index}`);
      })
      .on("end", () => {
        console.log(`Finished splitting segment ${index}`);
      })
      .run();
  });
}
