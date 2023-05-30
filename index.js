import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

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
let silenceStart;

const silenceDetect = ffmpeg(audioPath)
  .outputOptions([
    "-af",
    // Adjust '-50db' value to tweak silence volume threshold
    // Adjust '3.0' value to tweak silence duration threshold
    "silencedetect=noise=-30dB:d=4.0",
    "-f",
    "null",
  ])
  .output("pipe:1")
  .on("start", () => {
    console.log("Starting silence detection");
  })
  .on("stderr", (stderrLine) => {
    // console.log(stderrLine);
    // Extract start and end times of silence
    const silenceStartRegex = /silence_start: (\d+(\.\d+)?)/;
    const silenceEndRegex = /silence_end: (\d+\.\d+)/;

    const startMatch = silenceStartRegex.exec(stderrLine);
    const endMatch = silenceEndRegex.exec(stderrLine);

    // TODO: change logic in here to make segments

    // check whole file

    // if less than 30 minutes long, do not split

    // else find first segment after 30 minutes, when silent
    // keep looking up to 30 minutes for a segment
    // if none found ? error
    // split the audio in the middle point of the silent segment
    // continue process until audio end

    if (startMatch) {
      silenceStart = parseFloat(startMatch[1]);
      // console.log(`Silence detected at ${silenceStart}s`);
    } else if (endMatch) {
      const silenceEnd = parseFloat(endMatch[1]);
      // console.log(`Silence ended at ${silenceEnd}s`);
      segments.push({ start: silenceStart, end: silenceEnd });
    } else {
      // maybe add error if no silence in audio detected?
      // or may need to change silence thresholds
      // console.log(stderrLine);
    }
  })
  .on("end", () => {
    console.log("Silence detection complete.");
    console.log("segments: ", segments);
    splitAudio(audioPath, segments);
  });

// Execute the command if duration is longer than 30 minutes

getDuration(audioPath).then((duration) => {
  console.log(duration);
  if (duration > 1800) silenceDetect.exec();
});

function splitAudio(audioPath, segments) {
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // let start = 0;
  // segments.forEach((segment, index) => {
  //   const cutStart = start;
  //   const cutEnd = (segment.start + segment.end) / 2;
  //   const outputFileName = `part-${index + 1}.mp3`;
  //   const outputPath = path.join(outputDir, outputFileName);
  //   ffmpeg(audioPath)
  //     .setStartTime(cutStart)
  //     .setDuration(cutEnd - cutStart)
  //     .output(outputPath)
  //     .on("start", () => {
  //       console.log(`Starting to split segment ${index + 1}`);
  //     })
  //     .on("end", () => {
  //       console.log(`Finished splitting segment ${index + 1}`);
  //     })
  //     .on("error", (err) => {
  //       console.log(
  //         `Error occurred while splitting segment ${index + 1}: ${err.message}`
  //       );
  //     })
  //     .run();
  //   start = cutEnd;
  //   console.log(`start: ${start}`);
  // });
  // const outputFileName = `part-${segments.length + 1}.mp3`;
  // const outputPath = path.join(outputDir, outputFileName);
  // ffmpeg(audioPath)
  //   .setStartTime(start)
  //   .output(outputPath)
  //   .on("start", () => {
  //     console.log(`Starting to split the last segment`);
  //   })
  //   .on("end", () => {
  //     console.log(`Finished splitting the last segment`);
  //   })
  //   .on("error", (err) => {
  //     console.log(
  //       `Error occurred while splitting the last segment: ${err.message}`
  //     );
  //   })
  //   .run();
}
