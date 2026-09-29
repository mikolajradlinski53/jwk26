import { describe, it, expect } from "vitest";
import { numerSms, numeryDoWysylki, trescSms } from "../src/lib/sms";

describe("numerSms", () => {
  it("polski numer bez kierunkowego dostaje 48", () => {
    expect(numerSms("600100200")).toBe("48600100200");
    expect(numerSms("600 100 200")).toBe("48600100200");
    expect(numerSms("600-100-200")).toBe("48600100200");
  });

  it("numer z plusem albo 00 traci prefiks, zostaje kierunkowy", () => {
    expect(numerSms("+48 600 100 200")).toBe("48600100200");
    expect(numerSms("0048600100200")).toBe("48600100200");
    expect(numerSms("+420 601 234 567")).toBe("420601234567");
  });

  it("śmieci i za krótkie numery odpadają", () => {
    expect(numerSms("")).toBeNull();
    expect(numerSms("12345")).toBeNull();
    expect(numerSms("brak")).toBeNull();
    expect(numerSms("48+600100200")).toBeNull();
  });
});

describe("numeryDoWysylki", () => {
  it("ten sam numer w różnych zapisach idzie raz, złe znikają", () => {
    expect(numeryDoWysylki(["600100200", "+48 600 100 200", "xx", "700800900"])).toEqual([
      "48600100200",
      "48700800900",
    ]);
  });
});

describe("trescSms", () => {
  it("prefiks JWK26, tytuł i treść", () => {
    expect(trescSms(" Zbiórka ", " O 10:00 przy autokarze ")).toBe("JWK26: Zbiórka - O 10:00 przy autokarze");
    expect(trescSms("Zbiórka", null)).toBe("JWK26: Zbiórka");
  });
});
