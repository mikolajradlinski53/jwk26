import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admin,
  signIn,
  createUser,
  deleteUser,
  daneZapisu,
  ustawPule,
  ustawUstawienie,
  type TestUser,
} from "../helpers/supabase";

// Potwierdzenie przelewu w PDF (2026-10-11): bucket i ścieżka przyjmują .pdf,
// reszta formatów spoza obrazów dalej odbita.
let ala: TestUser;
let alaClient: SupabaseClient;
const wgrane: string[] = [];

const PDF = new Blob(["%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"], { type: "application/pdf" });

beforeAll(async () => {
  ala = await createUser("ala-pdf");
  alaClient = await signIn(ala);
  await ustawUstawienie("regulamin_zatwierdzony", true);
});

afterAll(async () => {
  await admin.from("registrations").delete().eq("user_id", ala.id);
  if (wgrane.length) await admin.storage.from("proofs").remove(wgrane);
  await ustawPule("dzialacze", false, 0);
  await ustawUstawienie("regulamin_zatwierdzony", false);
  await deleteUser(ala);
});

describe("przelew w PDF", () => {
  it("uczestnik wgrywa PDF do swojego folderu", async () => {
    const sciezka = `${ala.id}/potwierdzenie.pdf`;
    const { error } = await alaClient.storage.from("proofs").upload(sciezka, PDF, { contentType: "application/pdf" });
    expect(error).toBeNull();
    wgrane.push(sciezka);
  });

  it("plik innego typu dalej odbity", async () => {
    const sciezka = `${ala.id}/notatka.txt`;
    const { error } = await alaClient.storage
      .from("proofs")
      .upload(sciezka, new Blob(["x"], { type: "text/plain" }), { contentType: "text/plain" });
    expect(error).not.toBeNull();
    if (!error) wgrane.push(sciezka);
  });

  it("zgłoszenie ze ścieżką .pdf przechodzi, z .exe nie", async () => {
    await ustawPule("dzialacze", true, 10);
    const zloz = (p: string) =>
      alaClient.rpc("zloz_zgloszenie", { p_dane: daneZapisu(), p_proof_path: p, p_na_rezerwe: false });

    const zly = await zloz(`${ala.id}/potwierdzenie.exe`);
    expect(zly.error!.message).toMatch(/sciezka potwierdzenia/);

    const { error } = await zloz(`${ala.id}/potwierdzenie.pdf`);
    expect(error).toBeNull();
    const { data } = await admin.from("registrations").select("proof_path").eq("user_id", ala.id).single();
    expect(data!.proof_path).toBe(`${ala.id}/potwierdzenie.pdf`);
  });
});
