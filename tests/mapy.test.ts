import { describe, it, expect } from "vitest";
import { linkNawigacji, toKrotkiLink, wspolrzedneZTekstu } from "@/lib/mapy";

describe("współrzędne z linku Map Google", () => {
  it("pinezka miejsca ma pierwszeństwo przed środkiem widoku", () => {
    const link =
      "https://www.google.com/maps/place/%C5%9Anie%C5%BCka/@50.7360,15.7400,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d50.7359844!4d15.7398732";
    expect(wspolrzedneZTekstu(link)).toEqual({ lat: 50.7359844, lng: 15.7398732 });
  });

  it("środek widoku z @", () => {
    expect(wspolrzedneZTekstu("https://www.google.com/maps/@50.7781,15.7563,17z")).toEqual({ lat: 50.7781, lng: 15.7563 });
  });

  it("parametr q i query, także zakodowany przecinek", () => {
    expect(wspolrzedneZTekstu("https://maps.google.com/?q=50.7781,15.7563")).toEqual({ lat: 50.7781, lng: 15.7563 });
    expect(wspolrzedneZTekstu("https://www.google.com/maps/search/?api=1&query=50.7781%2C15.7563")).toEqual({
      lat: 50.7781,
      lng: 15.7563,
    });
  });

  it("same współrzędne wklejone ręcznie", () => {
    expect(wspolrzedneZTekstu(" 50.7781, 15.7563 ")).toEqual({ lat: 50.7781, lng: 15.7563 });
  });

  it("link bez współrzędnych i bzdury poza zakresem dają null", () => {
    expect(wspolrzedneZTekstu("https://www.google.com/maps/place/Karpacz")).toBeNull();
    expect(wspolrzedneZTekstu("150.1, 15.2")).toBeNull();
    expect(wspolrzedneZTekstu("")).toBeNull();
  });

  it("rozpoznaje krótki link do rozwinięcia", () => {
    expect(toKrotkiLink("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(toKrotkiLink("https://www.google.com/maps/@50,15,17z")).toBe(false);
    expect(toKrotkiLink("nie link")).toBe(false);
  });

  it("nawigacja piesza do punktu", () => {
    expect(linkNawigacji({ lat: 50.7781, lng: 15.7563 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=50.7781,15.7563&travelmode=walking",
    );
  });
});
