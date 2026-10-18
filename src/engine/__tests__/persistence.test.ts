import { describe, expect, it } from "vitest";
import { parseUniverse, serializeUniverse } from "@/engine/schema";
import { startUniverse, updateWrestler } from "@/engine/universe";
import { deleteSlot, listSlots, loadSlot, saveToSlot } from "@/lib/persistence";

const make = () => startUniverse({ name: "Test", promotionName: "Test Promo", startDate: "2026-01-05", startingCash: 5_000_000, difficulty: "normal", seed: 7 });

describe("save system", () => {
  it("round-trips a universe through export/import", () => {
    const u = make();
    updateWrestler(u, "marcus-vale", { popularity: 33 });
    const back = parseUniverse(serializeUniverse(u));
    expect(back.wrestlers["marcus-vale"].popularity).toBe(33);
    expect(back.championships["apex-world"].holderIds).toEqual(["drago-kessler"]);
    expect(back.shows.length).toBe(u.shows.length);
  });

  it("rejects invalid or future-version saves with a clear message", () => {
    expect(() => parseUniverse("not json")).toThrow(/valid JSON/);
    const u = make();
    const broken = JSON.parse(serializeUniverse(u));
    broken.universe.wrestlers["marcus-vale"].attributes.strength = 500;
    expect(() => parseUniverse(JSON.stringify(broken))).toThrow(/validation/);
    const future = JSON.parse(serializeUniverse(u));
    future.universe.schemaVersion = 99;
    expect(() => parseUniverse(JSON.stringify(future))).toThrow(/newer version/);
  });

  it("stores multiple slots in IndexedDB and loads them back", async () => {
    const a = make();
    const b = make();
    b.name = "Second";
    b.week = 5;
    await saveToSlot("slot-a", a);
    await saveToSlot("slot-b", b);
    const slots = await listSlots();
    expect(slots.map((s) => s.slot).sort()).toEqual(["slot-a", "slot-b"]);
    const loaded = await loadSlot("slot-b");
    expect(loaded?.name).toBe("Second");
    expect(loaded?.week).toBe(5);
    await deleteSlot("slot-a");
    expect((await listSlots()).map((s) => s.slot)).toEqual(["slot-b"]);
    expect(await loadSlot("slot-a")).toBeNull();
  });
});
