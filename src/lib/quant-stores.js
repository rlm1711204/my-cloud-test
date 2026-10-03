// The two parts built on quant-store.js: 🔢 Maths and 🧩 Reasoning. Each has its own data, backup and Drive file;
// anything added to one that belongs to the other subject is handed over.
import { createQuantStore } from "./quant-store.js";
import { QUANT, REASONING } from "./quant-taxonomy.js";

// "vv.quant.v1" is where the combined Maths & Reasoning part kept its data; Maths keeps that key and hands its
// reasoning cards to Reasoning (handOver) once the Formula Book has loaded.
export const maths = createQuantStore({ subject: QUANT, key: "vv.quant.v1", name: "Maths", other: () => reasoning });
export const reasoning = createQuantStore({ subject: REASONING, key: "vv.reasoning.v1", name: "Reasoning", other: () => maths });
