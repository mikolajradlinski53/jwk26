import type { ZdjecieDane } from "./Galeria";

/**
 * Zdjęcia z JWK 2026 na zaślepce po wyjeździe (2026-10-27). Wybrane ręcznie
 * spośród zaakceptowanych zgłoszeń bingo, gry terenowej i postów feedu:
 * bez nagości, bez alkoholu na pierwszym planie i bez wulgarnych napisów.
 *
 * Pliki zostają w prywatnym buckecie - adres idzie trasą feedu z sesją
 * (`/app/feed/zdjecie/<id>`), więc widzi je tylko zalogowany uczestnik
 * (decyzja Mikołaja: zgoda na wizerunek była dobrowolna, galeria nie jest
 * publiczna). Wymiary z plików, żeby kafelki nie skakały przy ładowaniu.
 */
const KADRY: [id: string, szerokosc: number, wysokosc: number][] = [
  ["0e01f0ef-42a9-4b6a-92b3-99efbc43d7e1", 1302, 976],
  ["2d259272-e079-4348-ba11-d0a7132a72a0", 1083, 1444],
  ["f13b99b7-a539-4ff5-801c-5d4cc5b560a3", 1444, 1083],
  ["e8b73996-e252-4b1a-8f75-bf2342e789cb", 1444, 1083],
  ["ef823d87-a822-468f-b958-51408c12f7ab", 1371, 1028],
  ["2515164f-6407-4e40-8b95-bf43254ab555", 1083, 1444],
  ["630cbab5-54e0-40aa-be87-648e771fca18", 1444, 1083],
  ["f02fa6cc-dbbe-44b2-a404-c63455d3542c", 1520, 1140],
  ["ecd5d89c-3c6d-4394-aace-db8f58b1a4d8", 927, 1236],
  ["284a8ecc-7a86-40ad-9e1b-58dfd9d15637", 1302, 976],
  ["628f1746-4ee8-4c54-ae78-e4dc38c56b55", 1371, 1028],
  ["7549510c-1a15-4f57-a134-00f7198d0513", 1083, 1444],
  ["c5c5262a-4d5d-4848-8689-995d8842d857", 1444, 1083],
  ["d624f2d6-86a2-4f02-a262-bcb21fc85cd9", 1302, 976],
  ["471294ea-4c46-44fb-8ff7-f0fb3881c4bc", 1140, 1520],
  ["19cd15b4-6707-4cf3-bd99-1a8966bfd188", 1444, 1083],
  ["0312c4ae-28b3-458d-9975-5256ec4478d2", 1520, 1140],
  ["48634def-6e3f-4dd2-b2a4-fb958867654e", 1371, 1028],
  ["ea20db13-83ad-439a-b831-5c4752f197d4", 1083, 1444],
  ["c2323bf6-09c1-4d35-8793-d0f0a8366f6f", 1302, 976],
  ["6de7e90e-6eb4-4865-a77f-dfe6867475d0", 1444, 1083],
  ["428fddb7-15f6-4172-8b8c-341e6bc13550", 1302, 976],
  ["8f2acabd-0a7d-4bc7-9a20-372e33c94dcc", 1083, 1444],
  ["b8fb64db-27db-4a75-a61b-a0fe3a2cfdd6", 1520, 1140],
  ["5d08fffd-c110-4e60-8d52-1bac59b6e613", 1520, 1140],
  ["49e12171-2e76-4474-89e9-267340017edb", 1083, 1444],
  ["c658a320-d307-47a7-a491-3a6a78558352", 1371, 1028],
  ["fcddf8d3-6a8e-45d9-adb1-846bf936ccf8", 1444, 1083],
  ["0fcce3ae-e2b6-48fe-ac16-0f422812f513", 1028, 1371],
  ["326a4411-780e-4b70-86f2-8678bf9c3f1b", 1444, 1083],
  ["b254cb89-66dc-426f-b8d9-402800b00bb9", 1083, 1444],
  ["9c00450b-1e59-41aa-bc3e-bf015423a4e0", 1444, 1083],
  ["a03e2319-6c43-464c-8135-70e7575e971d", 1371, 1028],
  ["f5787d65-ef86-48b4-8b96-877aa567bf8c", 976, 1302],
  ["4fccc153-58ef-42b1-871c-3b0db16fdc93", 976, 1302],
  ["2cc4fee9-db3f-4327-8f24-eb01b2de313b", 976, 1302],
  ["72d657b5-2368-4744-9425-d8092bb87965", 1028, 1371],
  ["cb6a3a48-dc16-442f-87ef-ea2e5c789478", 1140, 1520],
  ["c93fa3ef-c12a-41ed-b3ff-58b3903b4d76", 927, 1236],
  ["b9398d1b-f727-4122-9c3a-9408138168ab", 1083, 1444],
  ["d8b8c954-5761-41cd-8220-b4983930ee5e", 1140, 1520],
  ["a5e7a7a1-6ca8-4470-95d7-a6a67070ddec", 1520, 1140],
  ["a5992072-f4b2-4605-ad5e-1503238cb541", 812, 1444],
];

export const ZDJECIA_JWK26: ZdjecieDane[] = KADRY.map(([id, szerokosc, wysokosc]) => ({
  plik: id,
  szerokosc,
  wysokosc,
  src: `/app/feed/zdjecie/${id}?podglad`,
}));
