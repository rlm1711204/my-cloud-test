// "My Area" notes written by AI (Gemini → other services → Claude, the same engine as the rest of the app): one level
// at a time, in two requests (people & polity subjects, then land & economy subjects) so each reply stays complete.
import { AllProvidersFailed, aiTask, fallbackNote } from "./engine.js";
import { AREA_SCHEMA, areaInstruction, areaSystem, cleanNotes, levelName, sectionGroups } from "./area.js";

/**
 * Notes for one level of the place. Resolves {notes, provider, messages}; throws AllProvidersFailed if no AI wrote
 * anything. A group that fails is reported in `messages` and the other group's notes are kept.
 */
export async function areaNotes(s, place, key, onProgress) {
  const name = levelName(place, key);
  const used = new Set();
  const messages = new Set();
  const all = [];
  const groups = sectionGroups();
  let failed = 0;
  let lastError = null;
  for (const [i, sections] of groups.entries()) {
    onProgress?.(`Writing notes on ${name} (${i + 1} of ${groups.length})…`);
    try {
      const res = await aiTask(s, { system: areaSystem(), schema: AREA_SCHEMA, text: areaInstruction(place, key, sections) }, null);
      used.add(res.provider);
      const note = fallbackNote(res.skipped, res.provider);
      if (note) messages.add(note);
      all.push(...res.words.filter((x) => x && typeof x === "object" && x.note));
    } catch (e) {
      if (!(e instanceof AllProvidersFailed)) throw e;
      failed += 1;
      lastError = e;
      messages.add(e.message);
    }
  }
  const notes = cleanNotes(all);
  if (!notes.length) throw lastError || new AllProvidersFailed([{ name: [...used][0] || "AI", reason: `wrote no notes on ${name}` }]);
  if (failed) messages.add(`Part of the notes on ${name} couldn't be written (AI limit) — tap “Remake” later to fill them in.`);
  return { notes, provider: [...used].join(" + "), messages: [...messages] };
}
