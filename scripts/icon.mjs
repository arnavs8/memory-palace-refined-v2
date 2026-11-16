import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
const c = createCanvas(256, 256),
  x = c.getContext("2d");
x.fillStyle = "#244f40";
x.beginPath();
x.roundRect(0, 0, 256, 256, 48);
x.fill();
x.strokeStyle = "#eee6c7";
x.lineWidth = 12;
x.lineCap = "round";
x.lineJoin = "round";
x.beginPath();
x.moveTo(48, 93);
x.lineTo(128, 47);
x.lineTo(208, 93);
x.closePath();
x.stroke();
for (const a of [72, 128, 184]) {
  x.beginPath();
  x.moveTo(a, 117);
  x.lineTo(a, 180);
  x.stroke();
}
x.beginPath();
x.moveTo(49, 200);
x.lineTo(207, 200);
x.stroke();
const png = c.toBuffer("image/png");
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await mkdir("build", { recursive: true });
await writeFile("build/icon.png", png);
await writeFile("build/icon.ico", Buffer.concat([header, png]));
