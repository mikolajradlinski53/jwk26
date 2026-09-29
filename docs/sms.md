# SMS-y przez SMSAPI

Zaplecze jest gotowe i wyłączone. Po zakupie usługi włączenie to cztery kroki,
bez zmian w kodzie.

## Jak to działa

1. Admin w Sanktuarium → Ogłoszenia zaznacza „Wyślij też SMS-em”.
   `wyslij_ogloszenie(..., p_sms => true)` dopisuje do `powiadomienia` drugi
   wiersz z kanałem `sms`.
2. Wyzwalacz woła `pchnij_sms()`. Ta funkcja przez pg_net wysyła POST na
   adres z `sekrety.sms_url` z nagłówkiem `x-sms-sekret`. Pusty `sms_url`
   oznacza, że nic się nie dzieje.
3. Trasa `/api/sms` pobiera paczkę przez `pobierz_sms`. Paczka zawiera tylko
   numery przyjętych osób ze zgodą na SMS. Trasa wysyła paczkę do SMSAPI
   i oznacza ją przez `oznacz_sms`.
4. pg_cron (`ponow-sms`) ponawia wysyłkę co minutę, najwyżej 5 razy i tylko
   przez godzinę. Starszy SMS przepada: wysłanie komunikatu o zbiórce po
   trzech godzinach to strata pieniędzy.

Polskie znaki są zamieniane na łacińskie (`normalize=1`). Jedna część SMS-a
mieści wtedy 160 znaków zamiast 70. Ogłoszenie ma najwyżej 80 + 300 znaków,
czyli do 3 części na osobę.

## Włączenie po zakupie

1. **Token.** W panelu SMSAPI wejdź w Ustawienia API → Tokeny API (OAuth)
   i wygeneruj token z uprawnieniem „SMS”.
2. **Zmienne w Vercelu** (Production):
   - `SMSAPI_TOKEN`: token z punktu 1;
   - `SMS_SEKRET`: wartość z bazy produkcyjnej,
     `select wartosc from sekrety where klucz = 'sms';`;
   - opcjonalnie `SMSAPI_NADAWCA`: nazwa nadawcy zarejestrowana
     i zatwierdzona w SMSAPI (np. `JWK26`). Bez niej SMSAPI wyśle z nadawcy
     domyślnego;
   - opcjonalnie `SMSAPI_TEST=1` na pierwszą próbę. SMSAPI przyjmie
     żądanie, ale nic nie wyśle i nic nie pobierze.

   Po dodaniu zmiennych zrób ponowne wdrożenie (Redeploy).
3. **Adres trasy w bazie produkcyjnej:**
   ```sql
   update sekrety set wartosc = 'https://www.jwk26.pl/api/sms' where klucz = 'sms_url';
   ```
4. **Próba.** Wyślij ogłoszenie do siebie (np. do drużyny, w której jesteś
   tylko Ty) z zaznaczonym SMS-em. W historii ogłoszeń powinno pojawić się
   „SMS do N numerów”. Jeśli widać „SMS nie wyszedł”, przyczynę znajdziesz
   w logach funkcji w Vercelu (`SMSAPI odrzuciło wysyłkę` razem z kodem
   błędu). Na koniec usuń `SMSAPI_TEST`.

## Wyłączenie

`update sekrety set wartosc = '' where klucz = 'sms_url';` natychmiast
zatrzymuje wysyłkę. Wiersze, które zostaną w kolejce, przepadną po godzinie.
