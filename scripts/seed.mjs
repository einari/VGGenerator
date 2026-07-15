#!/usr/bin/env node
// Seed the site with hand-authored VG-style articles so it works out of the box
// without a running LLM. Same schema and image assignment as generate.mjs.
import { finalizeArticle, writeArticle, rebuildIndex } from './store.mjs'

const SEED = [
  {
    section: 'nyheter',
    kicker: 'TRAFIKKAOS',
    title: 'Rundkjøring på Jessheim gikk i lås: – Vi kjørte i ring i tre timer',
    lead: 'En helt vanlig tirsdag ble til et mareritt for bilistene i den nye rundkjøringen ved Jessheim storsenter. – Ingen turte å svinge av, forteller Roar (54).',
    body: [
      'Det hele startet ved 15-tiden, da trafikken inn mot rundkjøringen plutselig stoppet opp. Ingen vet helt hvem som ga etter for hvem.',
      '– Det ble sånn at alle bare ventet på alle. Etter en time begynte folk å hilse på hverandre for tredje gang, sier Roar Bjørnstad (54), som satt fast i sin Volvo.',
      'Vitner beskriver en nærmest meditativ stemning i bilkøen.',
      '– Vi delte matpakke gjennom vinduene. Jeg fikk to kvartkyllinger og en boks snus, forteller Anniken (31), som var på vei hjem fra jobb.',
      'Statens vegvesen bekrefter at de er kjent med hendelsen.',
      '– Vi minner om at man faktisk har lov til å kjøre ut av en rundkjøring. Det er liksom hele poenget, opplyser en talsperson til VG.',
      'Køen løste seg opp først da en trafikklærer tilfeldigvis kom forbi og pekte bestemt mot en avkjøring.',
    ],
    factBox: {
      title: 'Dette vet vi',
      items: [
        'Hendelsen skjedde ved Jessheim storsenter tirsdag ettermiddag.',
        'Anslagsvis 40 biler skal ha vært involvert.',
        'Ingen personer kom fysisk til skade.',
        'Rundkjøringen åpnet for tre uker siden.',
      ],
    },
    author: 'Ola-Kristian Nilsen',
    featured: true,
  },
  {
    section: 'forbruker',
    kicker: 'PRISSJOKK',
    title: 'Kaffeprisen eksploderer: Slik kan du spare 4 kroner om dagen',
    lead: 'Forbrukerøkonomen advarer: Nordmenn drikker seg fra gård og grunn. Men det finnes et knep.',
    body: [
      'En ny, oppdiktet rapport viser at prisen på en kopp kaffe på farten har steget med svimlende 800 prosent siden barndommen til de fleste.',
      '– Folk skjønner ikke hvor mye dette utgjør. Over 45 år blir dette til en hel campingvogn, sier forbrukerøkonom Terje Sandaker (48).',
      'Hans råd er enkelt, men kontroversielt.',
      '– Lag kaffen hjemme. Ja, jeg vet det høres vilt ut. Men det funker, sier han med alvorlig mine.',
      'Ikke alle er enige i innsparingsrådet.',
      '– Hjemme har jeg ikke barista som staver navnet mitt feil på koppen. Da mister jo hele opplevelsen mening, sier storforbruker Madeleine (26).',
    ],
    factBox: {
      title: 'Spar penger på kaffe',
      items: [
        'Kjøp kaffe i posen, ikke i koppen.',
        'Termos regnes fortsatt som lovlig.',
        'Ett gram pulverkaffe = fire kroner spart.',
      ],
    },
    author: 'Camilla Ryen',
    isPlus: true,
  },
  {
    section: 'sport',
    kicker: 'FOTBALL',
    title: 'Keeperen (34) slaktet av egen bestemor: – Han slipper inn alt',
    lead: 'Etter 6–0-tapet kom den knallharde dommen. Og den kom fra tribunen, rad tre.',
    body: [
      'Det var full krise for lokallaget Fjellhaug IL etter helgens kamp, og en av de tydeligste stemmene var uventet.',
      '– Jeg elsker gutten, men han fanger jo ingenting. Jeg har sett vaskekluter med bedre reflekser, sier bestemor Gerd (79) til VG.',
      'Keeper Kim-Andrè (34) tar kritikken med fatning.',
      '– Bestemor har alltid vært min hardeste kritiker. Hun sluttet å bake til meg etter forrige sesong, sier han.',
      'Trener Bjarne Holt forsvarer sisteskansen.',
      '– Vi vinner som et lag og taper som et lag. Men ja, akkurat i dag tapte vi mest på grunn av Kim-Andrè, innrømmer treneren.',
      'Fjellhaug ligger nå sist i sin avdeling, med en målforskjell laget selv omtaler som «privat».',
    ],
    author: 'Sigurd Aalborg',
    featured: false,
  },
  {
    section: 'rampelys',
    kicker: 'REALITY',
    title: 'Chris (28) forlot «Hyttedrama» etter krangel om oppvaskmaskin',
    lead: 'Stemningen kokte over i den mest sette dusjscenen på flere sesonger. – Han skjønner ikke tallerken-hierarkiet, sier medbeboer.',
    body: [
      'Reality-Norge er i sjokk etter at publikumsyndlingen Chris pakket kofferten og forlot hytta i går kveld.',
      '– Jeg orker ikke mer. De setter store tallerkener foran de små. Det er kaos, sier en tydelig preget Chris (28).',
      'Konflikten skal ha bygget seg opp over flere dager.',
      '– Chris er en fantastisk fyr, men han har veldig sterke meninger om bestikk-skuffen, forteller medbeboer Vanessa (24).',
      'Produksjonen bekrefter at ingen tallerkener kom fysisk til skade.',
      '– Vi ønsker Chris lykke til videre. Oppvaskmaskinen er nå tømt av et nøytralt teammedlem, heter det i en pressemelding.',
    ],
    author: 'Trine Hovden',
    isPlus: true,
  },
  {
    section: 'nyheter',
    kicker: 'DYRELIV',
    title: 'Måke stjal hel wienerpølse i Sandefjord: – Den så meg rett i øynene',
    lead: 'Sommeridyllen ble brutt da en usedvanlig frimodig måke gikk til angrep på grillmaten. Nå advarer eksperten.',
    body: [
      'Det som skulle bli en rolig grilldag i parken endte i drama for familien Rusten.',
      '– Den kom ovenfra som et jagerfly. Pølsa var borte før jeg rakk å legge på sennep, forteller far Kjetil (41).',
      'Datteren Emma (6) beskriver måken som «frekk, men effektiv».',
      'En selverklært måkeekspert mener befolkningen må ta grep.',
      '– Måkene har mistet all respekt for mennesket. De vet at vi ikke tør å gjøre noe. Vi har skapt et monster, sier ekspert Arild Vengen (63).',
      'Familien fikk til slutt en ny pølse av en medfølende nabo, som selv holdt vakt med en spade.',
    ],
    factBox: {
      title: 'Slik unngår du måkeangrep',
      items: [
        'Hold blikkontakt, men ikke utfordre til duell.',
        'Dekk til grillmaten – helst med lokk, ikke bare håp.',
        'Måker liker ikke plutselige, pinlige dansebevegelser.',
      ],
    },
    author: 'Line Fjeld',
    featured: true,
  },
  {
    section: 'meninger',
    kicker: 'KOMMENTAR',
    title: 'Nei, du trenger ikke fortelle meg at du står opp klokka fem',
    lead: 'Det finnes en type mennesker som må dø litt inni oss alle. De heter «morgenmennesker», og de vil at du skal vite det.',
    body: [
      'Jeg har en bekjennelse: hver gang noen sier «jeg er så produktiv før soloppgang», vurderer jeg å flytte til skogen.',
      'Det er ikke det at jeg misunner dem. Det er måten de sier det på. Som om de har funnet en hemmelighet resten av oss er for late til å oppdage.',
      'La meg være tydelig: å stå opp klokka fem gjør deg ikke til et bedre menneske. Det gjør deg til et menneske som er trøtt klokka to.',
      'Vi som lever i mørket har også verdi. Vi finner på våre beste idéer klokka 23.40, som naturen har bestemt.',
      'Så neste gang du vil fortelle meg om morgenrutinen din: la det være. Jeg sover.',
    ],
    author: 'Håvard Ulriksen',
  },
  {
    section: 'nyheter',
    kicker: 'VÆRET',
    title: 'Værekspert i alarm: – Det blir sommer, og vi aner ikke hvor lenge',
    lead: 'Meteorologen ber folk forberede seg på det verste: fint vær, muligens i flere dager.',
    body: [
      'En bekymret værekspert gikk i dag ut med en sjelden advarsel til det norske folk.',
      '– Vi ser tegn til vedvarende sol. Dette kan vare i opptil en uke, og det gjør folk uforutsigbare, sier meteorolog Hilde Aakre (52).',
      'Allerede nå meldes det om nordmenn som har tatt fram grillen «bare i tilfelle».',
      '– Vi ber folk holde hodet kaldt og shortsen ren. Ikke ta av deg sokkene i sandalen før det er trygt, sier hun.',
      'Butikkene rapporterer om hamstring av softis og hagestoler.',
      '– Sist det var sol så lenge, glemte halve nabolaget å komme på jobb, minner eksperten om.',
    ],
    author: 'Nora Dalseth',
  },
  {
    section: 'forbruker',
    kicker: 'TEST',
    title: 'Vi testet 14 typer brunost – én av dem forsvant sporløst',
    lead: 'Forbrukerredaksjonen tok jobben ingen andre ville ta. Resultatet overrasket selv de mest hardbarkede.',
    body: [
      'I tre uker har redaksjonen levd på brunost alene. Vi angrer ikke, men vi er ikke helt som før.',
      '– Test nummer sju smakte karamell og litt fortvilelse. Vi ga den likevel en sekser, forteller testleder Bjørnar (39).',
      'Én av de fjorten ostene lot seg aldri finne igjen etter dag to.',
      '– Vi vet den var her. Vi hørte den. Men den er borte nå, sier en tydelig merket testpanel-deltaker.',
      'Vinneren ble en anonym ost fra en ukjent seter, som panelet beskriver som «trygg, men mystisk».',
    ],
    factBox: {
      title: 'Slik testet vi',
      items: [
        '14 oster, blindtest, 3 dommere med sterke meninger.',
        'Poeng fra 1 til 6, der 6 er «ville giftet oss».',
        'Ingen kjeks ble skadet under testen.',
      ],
    },
    author: 'Bjørnar Sætre',
  },
  {
    section: 'sport',
    kicker: 'LANGRENN',
    title: 'Mosjonist (61) gikk feil løype – endte opp i nabokommunen',
    lead: 'Det som skulle være en rolig søndagstur ble til et 40 kilometer langt eventyr. – Jeg trodde jeg var nesten hjemme, sier Per.',
    body: [
      'Per Loftheim (61) la ut på det han trodde var en kort treningsrunde i marka søndag morgen.',
      '– Jeg fulgte bare sporet. Etter en stund lurte jeg på hvorfor alle husene så ukjente ut, forteller han.',
      'Da han til slutt spurte om veien, fikk han sjokk.',
      '– Damen jeg møtte sa «velkommen til nabokommunen». Jeg trodde hun tullet, sier Per.',
      'Han ble til slutt hentet av kona, som ikke var overrasket.',
      '– Han går alltid feil. Én gang endte han på et bryllup han ikke var invitert til. De ga ham kake, sier hun.',
    ],
    author: 'Kjetil Mork',
  },
  {
    section: 'rampelys',
    kicker: 'MUSIKK',
    title: 'Norsk artist droppet ny låt ingen ba om: – Den er faktisk ganske bra',
    lead: 'Popstjernen overrasket fansen med et comeback midt på natten. Reaksjonene lar vente på seg.',
    body: [
      'Artisten, kjent under artistnavnet «DJ Kveldsmat», slapp uventet en ny singel klokka 03.14 i natt.',
      '– Jeg følte det bare. Musikken kom til meg mens jeg lette etter ostehøvelen, forteller artisten (33).',
      'Låten, med tittelen «Skruball», har foreløpig fått blandet mottakelse.',
      '– Jeg vet ikke helt hva den handler om, men den sitter, sier fan Kristoffer (19).',
      'Artisten planlegger allerede oppfølgeren.',
      '– Neste låt blir enda mer personlig. Den handler om en parkeringsbot jeg fikk i 2019, avslører han.',
    ],
    author: 'Ingvild Rosenlund',
  },
  {
    section: 'nyheter',
    kicker: 'NABOKRANGEL',
    title: 'Strid om hekk endte i ni sider lange brev: – Jeg svarte med ti',
    lead: 'To naboer på Nesodden har ikke snakket sammen på fire år. Men de skriver desto mer.',
    body: [
      'Det som begynte med en centimeter hekk på feil side av gjerdet, har vokst til et diplomatisk kappløp uten sidestykke.',
      '– Han sendte meg et brev på ni sider om tujaen. Jeg svarte med ti, og la ved en skisse, sier Gunnar (66).',
      'Naboen på sin side føler seg misforstått.',
      '– Jeg ville bare snakke om hekken. Nå har vi et arkiv, sier Reidar (68) og peker på en full perm.',
      'Begge er enige om én ting: hekken har aldri hatt det bedre.',
      '– Den er blitt landsdelens mest velstelte hekk. Vi klipper på skift, uten å hilse, sier de.',
    ],
    factBox: {
      title: 'Dette vet vi',
      items: [
        'Konflikten har vart i fire år.',
        'Til sammen er det sendt over 300 sider korrespondanse.',
        'Hekken er 1,4 meter høy og «uskyldig i saken».',
      ],
    },
    author: 'Mette Brakstad',
    featured: true,
  },
  {
    section: 'forbruker',
    kicker: 'STRØM',
    title: 'Familie satte ny rekord: – Vi slo av alt, også hverandre',
    lead: 'Med hodelykt og trass tok familien Ødegård opp kampen mot strømregningen. Nå deler de sine ekstreme knep.',
    body: [
      'Familien på fire i Fredrikstad bestemte seg for å halvere forbruket, koste hva det koste ville.',
      '– Vi spiser nå middag i mørket. Barna vet ikke lenger hva som er på tallerkenen, og det synes vi er spennende, sier mor Solveig (43).',
      'Strømsparingen har ført til noen uventede familieøyeblikk.',
      '– Vi har begynt å fortelle historier ved stearinlys. Stort sett handler de om hvor mye vi savner varmt vann, sier far Trond (45).',
      'Eksperten er imponert, men bekymret.',
      '– Å spare strøm er bra. Å fryse på prinsipp er en norsk spesialitet vi kanskje bør vurdere på nytt, sier forbrukerøkonomen.',
    ],
    author: 'Anders Kvamme',
    isPlus: true,
  },
]

const now = Date.now()
let written = 0
SEED.forEach((raw, i) => {
  const publishedAt = new Date(now - i * 23 * 60_000).toISOString()
  const article = finalizeArticle(raw, { publishedAt, index: i, source: 'seed' })
  writeArticle(article)
  written++
  console.log(`  ✓ [${article.section}] ${article.title}`)
})
const index = rebuildIndex()
console.log(`\nSkrev ${written} seed-saker. Totalt ${index.length} i index.json.`)
