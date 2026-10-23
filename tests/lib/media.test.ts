import { describe, it, expect } from "vitest";
import { jestFilm, rozszerzenieFilmu, sciezkaPodgladu } from "@/lib/zgloszenieZdjecia";

describe("ścieżki mediów (filmy od 2026-10-23)", () => {
  it("podgląd zdjęcia i filmu to zawsze .podglad.jpg obok pliku", () => {
    expect(sciezkaPodgladu("u/abc.jpg")).toBe("u/abc.podglad.jpg");
    expect(sciezkaPodgladu("u/abc.mp4")).toBe("u/abc.podglad.jpg");
    expect(sciezkaPodgladu("u/abc.mov")).toBe("u/abc.podglad.jpg");
    expect(sciezkaPodgladu("u/abc.webm")).toBe("u/abc.podglad.jpg");
  });

  it("film rozpoznany po rozszerzeniu", () => {
    expect(jestFilm("u/abc.mp4")).toBe(true);
    expect(jestFilm("u/abc.MOV")).toBe(true);
    expect(jestFilm("u/abc.jpg")).toBe(false);
    expect(jestFilm("u/abc.podglad.jpg")).toBe(false);
  });

  it("rozszerzenie z typu pliku", () => {
    expect(rozszerzenieFilmu("video/mp4")).toBe("mp4");
    expect(rozszerzenieFilmu("video/quicktime")).toBe("mov");
    expect(rozszerzenieFilmu("video/webm")).toBe("webm");
    expect(rozszerzenieFilmu("video/x-matroska")).toBeNull();
  });
});
