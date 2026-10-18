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

describe("schema migrations", () => {
  it("upgrades a v1 save (no physiques) to v2 without losing edits", () => {
    const u = make();
    u.wrestlers["marcus-vale"].appearance.primaryColor = "#123456";
    const raw = JSON.parse(serializeUniverse(u));
    raw.universe.schemaVersion = 1;
    const bodyKeys = ["muscle", "definition", "bodyFat", "shoulderWidth", "armSize", "legSize", "bootColor", "kneepads", "wristTape"];
    for (const w of Object.values(raw.universe.wrestlers) as { appearance: Record<string, unknown> }[]) for (const k of bodyKeys) delete w.appearance[k];
    for (const d of Object.values(raw.universe.defaults) as Record<string, unknown>[]) delete d.appearance;
    // a custom wrestler that is not in the seed roster
    raw.universe.wrestlers["custom-1"] = { ...raw.universe.wrestlers["benji-moss"], id: "custom-1", isCustom: true };

    const back = parseUniverse(JSON.stringify(raw));
    expect(back.schemaVersion).toBe(2);
    const vale = back.wrestlers["marcus-vale"].appearance;
    expect(vale.primaryColor).toBe("#123456"); // player edit kept
    expect(vale.muscle).toBeGreaterThan(0.7); // seeded physique restored
    expect(back.defaults["marcus-vale"].appearance?.muscle).toBe(vale.muscle);
    const custom = back.wrestlers["custom-1"].appearance;
    for (const k of bodyKeys) expect(custom[k as keyof typeof custom]).toBeDefined();
  });
});
