import { describe, it, expect } from "vitest";
import { doCsv } from "../src/lib/csv";

describe("eksport CSV", () => {
  it("zaczyna się od BOM, dzieli średnikiem i łamie CRLF", () => {
    const csv = doCsv(["Imię", "Pula"], [["Ala", "Działacze"], ["Ola", null]]);
    // BOM, bo Excel bez niego czyta UTF-8 jako Windows-1250 i psuje ogonki.
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Imię;Pula\r\nAla;Działacze\r\nOla;\r\n");
  });

  it("bierze w cudzysłów wartości ze średnikiem, cudzysłowem i nową linią", () => {
    const csv = doCsv(["Uwagi"], [["bez glutenu; bez laktozy"], ['mówi "hej"'], ["dwie\nlinie"]]);
    expect(csv).toBe(
      '﻿Uwagi\r\n"bez glutenu; bez laktozy"\r\n"mówi ""hej"""\r\n"dwie\nlinie"\r\n',
    );
  });

  it("rozbraja wartości, które Excel wykonałby jako formułę", () => {
    // Pole wpisuje uczestnik - „=HYPERLINK(...)" w uwagach otwierałoby się
    // u organizatora jako formuła. Apostrof każe Excelowi czytać to jako tekst.
    const csv = doCsv(["x"], [["=1+1"], ["+48 600"], ["-5"], ["@SUMA"], ["zwykły"]]);
    expect(csv.split("\r\n").slice(1, 6)).toEqual(["'=1+1", "'+48 600", "'-5", "'@SUMA", "zwykły"]);
  });
});
