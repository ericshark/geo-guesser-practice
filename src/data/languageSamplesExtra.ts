import type { LanguageSample, LanguageSpec } from './types.ts';

/**
 * Extra everyday signage per language (pharmacy, emergency exit, bakery, restricted access).
 * The original samples lean on road and school wording; these add the shopfront and public-notice
 * vocabulary that turns up in real rounds. Tuple: [kind, text, English translation].
 * Languages are listed only where the wording has been checked; the rest keep their base samples.
 */
type Extra = ['sign' | 'sentence', string, string];

const EXTRA: Record<string, Extra[]> = {
  pt: [
    ['sign', 'Farmácia · Aberta 24 horas', 'Pharmacy · Open 24 hours'],
    ['sign', 'Saída de emergência', 'Emergency exit'],
    ['sign', 'Padaria e Confeitaria Pão Quente', 'Bakery and pastry shop "Hot Bread"'],
    ['sentence', 'Proibida a entrada de animais', 'No animals allowed in'],
  ],
  es: [
    ['sign', 'Farmacia de guardia · Abierto las 24 horas', 'On-duty pharmacy · Open 24 hours'],
    ['sign', 'Salida de emergencia', 'Emergency exit'],
    ['sign', 'Panadería y pastelería La Esperanza', 'Bakery and pastry shop "La Esperanza"'],
    ['sentence', 'Prohibido el paso a personas no autorizadas', 'No entry for unauthorised persons'],
  ],
  fr: [
    ['sign', 'Boulangerie · Pâtisserie · Ouvert du mardi au dimanche', 'Bakery · Pastry shop · Open Tuesday to Sunday'],
    ['sign', 'Sortie de secours', 'Emergency exit'],
    ['sign', 'Hôtel de ville · Place de la Mairie', 'Town hall · Town Hall Square'],
    ['sentence', 'Accès réservé aux riverains', 'Access for residents only'],
  ],
  it: [
    ['sign', 'Farmacia · Aperto tutti i giorni', 'Pharmacy · Open every day'],
    ['sign', 'Uscita di emergenza', 'Emergency exit'],
    ['sign', 'Pasticceria Bar Centrale', 'Pastry shop and café "Central"'],
    ['sentence', 'Divieto di accesso ai non autorizzati', 'No access for unauthorised persons'],
  ],
  ca: [
    ['sign', 'Farmàcia · Obert les 24 hores', 'Pharmacy · Open 24 hours'],
    ['sign', 'Sortida d’emergència', 'Emergency exit'],
    ['sign', 'Forn de pa i pastisseria', 'Bread oven and pastry shop'],
    ['sentence', 'Prohibit el pas a persones alienes', 'No entry for outsiders'],
  ],
  ro: [
    ['sign', 'Farmacie · Deschis non-stop', 'Pharmacy · Open non-stop'],
    ['sign', 'Ieșire de urgență', 'Emergency exit'],
    ['sign', 'Primăria Orașului · Piața Centrală', 'City hall · Central Square'],
    ['sentence', 'Intrarea interzisă persoanelor neautorizate', 'No entry for unauthorised persons'],
  ],
  de: [
    ['sign', 'Apotheke · Notdienst', 'Pharmacy · Emergency service'],
    ['sign', 'Notausgang · Nicht versperren', 'Emergency exit · Do not block'],
    ['sign', 'Bäckerei und Konditorei Müller', 'Müller bakery and confectionery'],
    ['sentence', 'Zutritt nur für Befugte', 'Authorised persons only'],
  ],
  nl: [
    ['sign', 'Apotheek · Open van 8 tot 18 uur', 'Pharmacy · Open from 8 to 18'],
    ['sign', 'Nooduitgang', 'Emergency exit'],
    ['sign', 'Bakkerij en banketbakkerij De Gouden Korenaar', 'Bakery and pastry shop "The Golden Ear of Wheat"'],
    ['sentence', 'Verboden toegang voor onbevoegden', 'No entry for unauthorised persons'],
  ],
  sv: [
    ['sign', 'Apotek · Öppet alla dagar', 'Pharmacy · Open every day'],
    ['sign', 'Nödutgång', 'Emergency exit'],
    ['sign', 'Bageri och konditori', 'Bakery and café-bakery'],
    ['sentence', 'Obehöriga äga ej tillträde', 'No entry for unauthorised persons'],
  ],
  no: [
    ['sign', 'Apotek · Åpent hver dag', 'Pharmacy · Open every day'],
    ['sign', 'Nødutgang', 'Emergency exit'],
    ['sign', 'Bakeri og konditori', 'Bakery and confectionery'],
    ['sentence', 'Uvedkommende har ikke adgang', 'No access for unauthorised persons'],
  ],
  da: [
    ['sign', 'Apotek · Åbent alle dage', 'Pharmacy · Open every day'],
    ['sign', 'Nødudgang', 'Emergency exit'],
    ['sign', 'Bageri og konditori', 'Bakery and confectionery'],
    ['sentence', 'Adgang forbudt for uvedkommende', 'No access for unauthorised persons'],
  ],
  is: [
    ['sign', 'Apótek · Opið alla daga', 'Pharmacy · Open every day'],
    ['sign', 'Neyðarútgangur', 'Emergency exit'],
    ['sign', 'Bakarí og kaffihús', 'Bakery and café'],
    ['sentence', 'Aðgangur bannaður óviðkomandi', 'No access for unauthorised persons'],
  ],
  pl: [
    ['sign', 'Apteka · Czynna całą dobę', 'Pharmacy · Open around the clock'],
    ['sign', 'Wyjście ewakuacyjne', 'Evacuation exit'],
    ['sign', 'Piekarnia i cukiernia', 'Bakery and pastry shop'],
    ['sentence', 'Wstęp wzbroniony osobom nieupoważnionym', 'No entry for unauthorised persons'],
  ],
  cs: [
    ['sign', 'Lékárna · Otevřeno každý den', 'Pharmacy · Open every day'],
    ['sign', 'Nouzový východ', 'Emergency exit'],
    ['sign', 'Pekárna a cukrárna', 'Bakery and confectionery'],
    ['sentence', 'Vstup zakázán nepovolaným osobám', 'No entry for unauthorised persons'],
  ],
  sk: [
    ['sign', 'Lekáreň · Otvorené každý deň', 'Pharmacy · Open every day'],
    ['sign', 'Núdzový východ', 'Emergency exit'],
    ['sign', 'Pekáreň a cukráreň', 'Bakery and confectionery'],
    ['sentence', 'Vstup zakázaný nepovolaným osobám', 'No entry for unauthorised persons'],
  ],
  hu: [
    ['sign', 'Gyógyszertár · Nyitva minden nap', 'Pharmacy · Open every day'],
    ['sign', 'Vészkijárat', 'Emergency exit'],
    ['sign', 'Pékség és cukrászda', 'Bakery and confectionery'],
    ['sentence', 'Illetéktelenek számára a belépés tilos', 'No entry for unauthorised persons'],
  ],
  sl: [
    ['sign', 'Lekarna · Odprto vsak dan', 'Pharmacy · Open every day'],
    ['sign', 'Zasilni izhod', 'Emergency exit'],
    ['sign', 'Pekarna in slaščičarna', 'Bakery and confectionery'],
    ['sentence', 'Vstop prepovedan nepooblaščenim osebam', 'No entry for unauthorised persons'],
  ],
  hr: [
    ['sign', 'Ljekarna · Otvoreno svaki dan', 'Pharmacy · Open every day'],
    ['sign', 'Izlaz u slučaju opasnosti', 'Emergency exit'],
    ['sign', 'Pekarnica i slastičarnica', 'Bakery and confectionery'],
    ['sentence', 'Zabranjen ulaz neovlaštenim osobama', 'No entry for unauthorised persons'],
  ],
  fi: [
    ['sign', 'Apteeki · Avoinna joka päivä', 'Pharmacy · Open every day'],
    ['sign', 'Hätäuloskäynti', 'Emergency exit'],
    ['sign', 'Leipomo ja kahvila', 'Bakery and café'],
    ['sentence', 'Asiaton oleskelu kielletty', 'No unauthorised presence'],
  ],
  et: [
    ['sign', 'Apteek · Avatud iga päev', 'Pharmacy · Open every day'],
    ['sign', 'Hädaväljapääs', 'Emergency exit'],
    ['sign', 'Pagaritöökoda ja kohvik', 'Bakery and café'],
    ['sentence', 'Kõrvalistel isikutel sissepääs keelatud', 'No entry for outsiders'],
  ],
  lv: [
    ['sign', 'Aptieka · Atvērta katru dienu', 'Pharmacy · Open every day'],
    ['sign', 'Avārijas izeja', 'Emergency exit'],
    ['sign', 'Maiznīca un konditoreja', 'Bakery and confectionery'],
    ['sentence', 'Nepiederošām personām ieeja aizliegta', 'No entry for unauthorised persons'],
  ],
  lt: [
    ['sign', 'Vaistinė · Atidaryta kasdien', 'Pharmacy · Open daily'],
    ['sign', 'Avarinis išėjimas', 'Emergency exit'],
    ['sign', 'Kepykla ir konditerija', 'Bakery and confectionery'],
    ['sentence', 'Pašaliniams asmenims įeiti draudžiama', 'No entry for outsiders'],
  ],
  ru: [
    ['sign', 'Аптека · Круглосуточно', 'Pharmacy · Around the clock'],
    ['sign', 'Запасной выход', 'Emergency exit'],
    ['sign', 'Пекарня и кондитерская', 'Bakery and confectionery'],
    ['sentence', 'Посторонним вход воспрещён', 'No entry for unauthorised persons'],
  ],
  uk: [
    ['sign', 'Аптека · Цілодобово', 'Pharmacy · Around the clock'],
    ['sign', 'Запасний вихід', 'Emergency exit'],
    ['sign', 'Пекарня та кондитерська', 'Bakery and confectionery'],
    ['sentence', 'Стороннім вхід заборонено', 'No entry for unauthorised persons'],
  ],
  bg: [
    ['sign', 'Аптека · Отворено всеки ден', 'Pharmacy · Open every day'],
    ['sign', 'Авариен изход', 'Emergency exit'],
    ['sign', 'Пекарна и сладкарница', 'Bakery and confectionery'],
    ['sentence', 'Вход забранен за външни лица', 'No entry for outsiders'],
  ],
  sr: [
    ['sign', 'Апотека · Отворено сваког дана', 'Pharmacy · Open every day'],
    ['sign', 'Излаз за случај опасности', 'Emergency exit'],
    ['sign', 'Пекара и посластичарница', 'Bakery and confectionery'],
    ['sentence', 'Забрањен улаз неовлашћеним лицима', 'No entry for unauthorised persons'],
  ],
  mk: [
    ['sign', 'Аптека · Отворено секој ден', 'Pharmacy · Open every day'],
    ['sign', 'Излез за итни случаи', 'Emergency exit'],
    ['sign', 'Пекара и слаткарница', 'Bakery and confectionery'],
    ['sentence', 'Забранет влез за неовластени лица', 'No entry for unauthorised persons'],
  ],
  el: [
    ['sign', 'Φαρμακείο · Ανοιχτό καθημερινά', 'Pharmacy · Open daily'],
    ['sign', 'Έξοδος κινδύνου', 'Emergency exit'],
    ['sign', 'Αρτοποιείο και ζαχαροπλαστείο', 'Bakery and confectionery'],
    ['sentence', 'Απαγορεύεται η είσοδος σε μη εξουσιοδοτημένα άτομα', 'No entry for unauthorised persons'],
  ],
  tr: [
    ['sign', 'Nöbetçi Eczane', 'On-duty pharmacy'],
    ['sign', 'Acil çıkış', 'Emergency exit'],
    ['sign', 'Fırın ve pastane', 'Bakery and pastry shop'],
    ['sentence', 'Yetkili olmayanların girmesi yasaktır', 'Entry by unauthorised persons is forbidden'],
  ],
  he: [
    ['sign', 'בית מרקחת · פתוח כל יום', 'Pharmacy · Open every day'],
    ['sign', 'יציאת חירום', 'Emergency exit'],
    ['sign', 'מאפייה וקונדיטוריה', 'Bakery and confectionery'],
    ['sentence', 'הכניסה אסורה לבלתי מורשים', 'No entry for unauthorised persons'],
  ],
  ar: [
    ['sign', 'صيدلية · مفتوحة طوال اليوم', 'Pharmacy · Open all day'],
    ['sign', 'مخرج الطوارئ', 'Emergency exit'],
    ['sign', 'مخبز وحلويات', 'Bakery and sweets'],
    ['sentence', 'ممنوع الدخول لغير المصرح لهم', 'No entry for unauthorised persons'],
  ],
  ka: [
    ['sign', 'აფთიაქი · ღიაა ყოველდღე', 'Pharmacy · Open every day'],
    ['sign', 'საავარიო გასასვლელი', 'Emergency exit'],
    ['sign', 'საცხობი და საკონდიტრო', 'Bakery and confectionery'],
    ['sentence', 'შესვლა აკრძალულია', 'Entry is forbidden'],
  ],
  ja: [
    ['sign', '薬局 · 年中無休', 'Pharmacy · Open all year'],
    ['sign', '非常口', 'Emergency exit'],
    ['sign', 'パン屋 · 洋菓子店', 'Bakery · Western confectionery'],
    ['sentence', '関係者以外立入禁止', 'No entry except for authorised persons'],
  ],
  ko: [
    ['sign', '약국 · 연중무휴', 'Pharmacy · Open all year'],
    ['sign', '비상구', 'Emergency exit'],
    ['sign', '빵집 · 제과점', 'Bakery · Confectionery'],
    ['sentence', '관계자 외 출입금지', 'No entry except for authorised persons'],
  ],
  'zh-hans': [
    ['sign', '药店 · 24小时营业', 'Pharmacy · Open 24 hours'],
    ['sign', '安全出口', 'Emergency exit'],
    ['sign', '面包店 · 糕点', 'Bakery · Pastries'],
    ['sentence', '闲人免进', 'No entry for unauthorised persons'],
  ],
  'zh-hant': [
    ['sign', '藥局 · 全年無休', 'Pharmacy · Open all year'],
    ['sign', '緊急出口', 'Emergency exit'],
    ['sign', '麵包店 · 糕餅', 'Bakery · Pastries'],
    ['sentence', '非工作人員請勿進入', 'Staff only, please do not enter'],
  ],
  th: [
    ['sign', 'ร้านขายยา · เปิดทุกวัน', 'Pharmacy · Open every day'],
    ['sign', 'ทางออกฉุกเฉิน', 'Emergency exit'],
    ['sign', 'ร้านเบเกอรี่', 'Bakery'],
    ['sentence', 'ห้ามเข้า เฉพาะเจ้าหน้าที่', 'No entry, staff only'],
  ],
  vi: [
    ['sign', 'Nhà thuốc · Mở cửa mỗi ngày', 'Pharmacy · Open every day'],
    ['sign', 'Lối thoát hiểm', 'Emergency exit'],
    ['sign', 'Tiệm bánh mì', 'Bread shop'],
    ['sentence', 'Khu vực cấm vào', 'No entry area'],
  ],
  id: [
    ['sign', 'Apotek · Buka setiap hari', 'Pharmacy · Open every day'],
    ['sign', 'Pintu keluar darurat', 'Emergency exit'],
    ['sign', 'Toko roti dan kue', 'Bread and cake shop'],
    ['sentence', 'Dilarang masuk selain petugas', 'No entry except for staff'],
  ],
  tl: [
    ['sign', 'Botika · Bukas araw-araw', 'Pharmacy · Open every day'],
    ['sign', 'Labasan sa emerhensiya', 'Emergency exit'],
    ['sign', 'Panaderya at pastelerya', 'Bakery and pastry shop'],
    ['sentence', 'Bawal pumasok ang walang pahintulot', 'No entry without permission'],
  ],
  hi: [
    ['sign', 'दवाई की दुकान · रोज़ खुला', 'Pharmacy · Open daily'],
    ['sign', 'आपातकालीन निकास', 'Emergency exit'],
    ['sign', 'बेकरी और मिठाई की दुकान', 'Bakery and sweet shop'],
    ['sentence', 'अनधिकृत प्रवेश वर्जित', 'Unauthorised entry prohibited'],
  ],
  bn: [
    ['sign', 'ওষুধের দোকান · প্রতিদিন খোলা', 'Pharmacy · Open every day'],
    ['sign', 'জরুরি বহির্গমন পথ', 'Emergency exit'],
    ['sign', 'বেকারি ও মিষ্টির দোকান', 'Bakery and sweet shop'],
    ['sentence', 'অনধিকার প্রবেশ নিষেধ', 'Trespassing prohibited'],
  ],
  ta: [
    ['sign', 'மருந்தகம் · தினமும் திறந்திருக்கும்', 'Pharmacy · Open every day'],
    ['sign', 'அவசர வெளியேற்ற வழி', 'Emergency exit'],
    ['sign', 'பேக்கரி மற்றும் இனிப்பகம்', 'Bakery and sweet shop'],
    ['sentence', 'அனுமதியின்றி உள்ளே நுழையக்கூடாது', 'Do not enter without permission'],
  ],
  te: [
    ['sign', 'మందుల దుకాణం · ప్రతిరోజూ తెరిచి ఉంటుంది', 'Pharmacy · Open every day'],
    ['sign', 'అత్యవసర నిష్క్రమణ మార్గం', 'Emergency exit'],
    ['sign', 'బేకరీ మరియు స్వీట్ షాప్', 'Bakery and sweet shop'],
    ['sentence', 'అనుమతి లేకుండా ప్రవేశం నిషేధం', 'Entry without permission prohibited'],
  ],
  sw: [
    ['sign', 'Duka la dawa · Wazi kila siku', 'Pharmacy · Open every day'],
    ['sign', 'Mlango wa dharura', 'Emergency door'],
    ['sign', 'Mikate na keki', 'Bread and cakes'],
    ['sentence', 'Hairuhusiwi kuingia bila ruhusa', 'Entry without permission is not allowed'],
  ],
  af: [
    ['sign', 'Apteek · Elke dag oop', 'Pharmacy · Open every day'],
    ['sign', 'Nooduitgang · Moenie blokkeer nie', 'Emergency exit · Do not block'],
    ['sign', 'Bakkery en banketbakkery', 'Bakery and pastry shop'],
    ['sentence', 'Toegang verbode vir ongemagtigdes', 'No access for unauthorised persons'],
  ],
  mt: [
    ['sign', 'Spiżerija · Miftuħ kuljum', 'Pharmacy · Open daily'],
    ['sign', 'Ħruġ ta’ emerġenza', 'Emergency exit'],
    ['sign', 'Forn u Pastizzeria', 'Bakery and pastry shop'],
    ['sentence', 'Dħul ipprojbit għal persuni mhux awtorizzati', 'No entry for unauthorised persons'],
  ],
};

/** Returns the language with its extra samples appended (ids `<lang>-x1`...). */
export function withExtraSamples(language: LanguageSpec): LanguageSpec {
  const extra = EXTRA[language.id];
  if (!extra) return language;
  const tellIds = language.tells.map((t) => t.id);
  const samples: LanguageSample[] = extra.map(([kind, text, translation], i) => ({
    id: `${language.id}-x${i + 1}`,
    text,
    translation,
    kind,
    // Every tell is offered; the content layer keeps only those that actually match the text.
    tellIds,
  }));
  return { ...language, samples: [...language.samples, ...samples] };
}

export const LANGUAGES_WITH_EXTRA_SAMPLES = Object.keys(EXTRA);
