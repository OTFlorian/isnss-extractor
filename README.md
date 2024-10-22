# Generátor záhlaví rozhodnutí Nejvyššího správního soudu

## Popis

Toto rozšíření prohlížeče extrahuje informace z věcí soudního výkonu (SVInfo) v ISNSS a zkopíruje je do schránky pro následné vložení (Ctrl+V) do záhlaví rozhodnutí.

## Autor

Autorem rozšíření je [JUDr. Oldřich Tristan Florian, Ph.D.](https://otflorian.com)

## Funkce

- Extrahuje informace z případů vedených u Nejvyššího správního soudu.
- Kopíruje informace do schránky pro následné vložení.
- Umožňuje uživatelům přizpůsobit formát extrahovaných informací.
- Zpracování probíhá na počítači uživatele. Žádné informace o věci se neposílají na vzdálený server.

## Známé problémy

- Nedetekuje se, zda se jedná o advokáta, nebo advokátku.
- Skloňuje i nepřechýlená ženská příjmení advokátek.
  - Správně by však měla zůstat v prvním pádě.
- Jména účastníků nejsou ztučněná.
- Adresy jsou ve stejném tvaru jako v ISNSS, obsahují tedy PSČ a další nepotřebné informace.
  - Některé informace pak mnohdy chybí, například městská část Prahy.
- Pro označení účastníků je standardní mužský rod, označení v ženském rodě je potřeba vepsat ručně.
  - Například žalobkyně se ukazuje jako žalobce.
- Bez větších potíží zvládá pouze standardní případy.
  - V případě návrhů na zrušení opatření obecné povahy jsou tato opatření nesprávně označena.

Pokud přijdete na další problémy, otevřete prosím issue v [GitHub repozitáři](https://github.com/OTFlorian/isnss-extractor/issues), případně mi napište na e-mailovou adresu, kterou najdete na [mé osobní stránce](https://otflorian.com).

## Instalace

1. Přidejte rozšíření prostřednictvím [Chrome Web Store](https://chromewebstore.google.com/detail/nobghfommjhpmomgocbimojglpccmech) do vašeho prohlížeče.
    - Preferovaným prohlížečem na NSS je Microsoft Edge.
2. Klikněte na ikonu puzzle (rozšíření) vedle adresního řádku.
3. Najděte své rozšíření a klikněte na ikonu `Připnout`, aby se zobrazilo vedle adresního řádku.

Aktualizace probíhá automaticky.

## Použití

1. Otevřete stránku, která obsahuje informace o věci soudního výkonu (SVInfo) v ISNSS.
    - Například [isnss/main.aspx?cls=SVInfo&pId=76691](http://isnss/main.aspx?cls=SVInfo&pId=76691)
2. Klikněte na ikonu rozšíření vedle adresního řádku pro zobrazení vyskakovacího okna rozšíření.
3. Ve vyskakovacím okně klikněte na `Extrahovat informace`.
4. Informace budou zkopírovány do schránky.
5. Vložte do dokumentu (Ctrl+V).
6. Překontrolujte si veškeré vložené informace a upravte (viz `Známé problémy`).

## Struktura projektu

- `manifest.json`: Konfigurační soubor rozšíření
- `background.js`: Skript běžící na pozadí
- `content.js`: Skript, který extrahuje informace ze stránky
- `popup.html`: HTML soubor pro vyskakovací okno rozšíření
- `popup.js`: JavaScript soubor pro vyskakovací okno rozšíření
- `styles.css`: CSS styly pro vyskakovací okno rozšíření

## Licence
Tento projekt je licencován pod vlastní licencí. Viz soubor [LICENSE](./LICENSE) pro více informací.

## Příspěvky na kávu
Pokud byste mi chtěli koupit kávu, můžete [zde](https://buymeacoffee.com/otflorian).
