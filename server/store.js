import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 基于 import.meta.url 定位数据目录，避免写死 /Users、C:\ 或 /tmp 等绝对路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const EMPTY_STORE = {
  documents: [],
  parses: [],
  orgChart: { departments: [], reporting: [] },
};

// 整体在内存里改，再 writeFileSync 落盘，避免并发写坏 JSON 文件
let store = null;

export function initStore() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });

  if (!existsSync(STORE_PATH)) {
    store = structuredClone(EMPTY_STORE);
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } else {
    store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
  }
  return store;
}

function getStore() {
  if (!store) {
    initStore();
  }
  return store;
}

function save() {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export function addDocument(doc) {
  getStore().documents.push(doc);
  save();
}

export function getDocumentById(id) {
  return getStore().documents.find((doc) => doc.id === id);
}

export function addParse(parse) {
  getStore().parses.push(parse);
  save();
}

export function getParses() {
  return getStore().parses;
}

export function getParseById(id) {
  return getStore().parses.find((parse) => parse.id === id);
}

export function getOrgChart() {
  return getStore().orgChart;
}

export function setOrgChart(orgChart) {
  getStore().orgChart = orgChart;
  save();
}
