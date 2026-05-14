import dotenv from "dotenv";
import SimpleChat from "./Chat.ts";
import { tools } from "./tools/index.ts";

dotenv.config();

const API_KEY = process.env.MIMO_API_KEY || "";
const BASE_URL = process.env.MIMO_BASE_URL || "";

async function main() {
  const chat = new SimpleChat(
    API_KEY,
    BASE_URL,
    "你是一个智能助手，可以查询天气和计算",
    tools,
  );
  const response = await chat.sendMessage("今天北京天气怎么样");
  console.log(response);
}

main();
