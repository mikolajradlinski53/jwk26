import { Ekran } from "@/components/Ekran";

export default function FeedPage() {
  return (
    <Ekran tytul="Feed" podtytul="Zaakceptowane dowody">
      <p className="szklo rounded-md px-4 py-6 text-center text-sm text-dym">
        Tu wylądują zdjęcia z bingo, kiedy tylko ktoś zacznie je wrzucać.
      </p>
    </Ekran>
  );
}
