// Recipes are data assets — the same shape the brief sketched. Each step has a
// completion condition the CookingSim watches, an instruction shown in the book
// and HUD, and a line of family memory that lands when the step completes.
// Season One, Episode One: Pulut Kuning.
export const pulutKuning = {
  id: 'pulut-kuning',
  title: 'Pulut Kuning',
  subtitle: 'Fragrant golden glutinous rice — served at kenduri, births, and celebrations.',
  season: 1,
  episode: 1,
  ingredients: [
    { id: 'rice', name: 'Glutinous rice', note: '2 cups' },
    { id: 'turmeric', name: 'Turmeric', note: '1 tsp' },
    { id: 'santan', name: 'Thick coconut milk', note: '1 cup' },
    { id: 'pandan', name: 'Pandan leaves', note: '2, knotted' },
    { id: 'salt', name: 'Salt', note: '1 tsp' },
  ],
  steps: [
    {
      id: 'wash',
      title: 'Wash the rice',
      instruction: 'Take the bowl of rice and swirl it with your hand until the water runs clear.',
      condition: { type: 'SWIRL', threshold: 6 }, // radians of accumulated swirl
      memory: '“Bonda always said — feel the grains. When the water clears, the rice is ready.”',
    },
    {
      id: 'turmeric',
      title: 'Colour with turmeric',
      instruction: 'Sprinkle the turmeric over the rice. Watch it turn the gold of celebration.',
      condition: { type: 'SPRINKLE', threshold: 1 },
      memory: '“Kuning — the colour of a kenduri. Your grandfather could smell it from the road.”',
    },
    {
      id: 'santan',
      title: 'Pour the santan',
      instruction: 'Tilt the jug and pour the coconut milk over the rice until it just covers.',
      condition: { type: 'POUR', threshold: 1 },
      memory: '“Santan makes it rich. Not too much — the rice must still stand proud.”',
    },
    {
      id: 'steam',
      title: 'Steam it',
      instruction: 'Set the rice in the steamer and lower the lid. Let the steam do its quiet work.',
      condition: { type: 'STEAM_TIME', threshold: 6 },
      memory: '“Patience. The kitchen fills with fragrance and the whole house wakes up hungry.”',
    },
    {
      id: 'fluff',
      title: 'Fluff & moisten',
      instruction: 'Take the wooden paddle and lift the rice gently, again and again, until it glistens.',
      condition: { type: 'FLUFF', threshold: 8 },
      memory: '“Lift, don’t stir. Each grain should shine like it has somewhere to be.”',
    },
    {
      id: 'plate',
      title: 'Shape & serve',
      instruction: 'Shape the pulut on the banana leaf. It is ready to share.',
      condition: { type: 'PLATE', threshold: 1 },
      memory: '“Now we eat together. That is the whole point of cooking, child.”',
    },
  ],
  closing:
    '“You made Pulut Kuning the way I did, and my mother before me. Keep the recipe. Keep the people who taught it to you.” — Bonda',
};

// Season One, Episode Two: Sira Pisang — bananas simmered in fragrant gula
// melaka syrup. A humble, nostalgic dessert. Reuses the same physical verbs
// (place, pour, stir, glaze, plate) at the same worktop station.
export const pisangSira = {
  id: 'pisang-sira',
  title: 'Sira Pisang',
  subtitle: 'Ripe bananas glazed in fragrant gula melaka syrup — humble and comforting.',
  season: 1,
  episode: 2,
  ingredients: [
    { id: 'banana', name: 'Ripe bananas', note: 'pisang awak, halved' },
    { id: 'gula', name: 'Gula melaka', note: '2 tbsp, chopped' },
    { id: 'sugar', name: 'Sugar', note: '½ cup' },
    { id: 'pandan', name: 'Pandan leaf', note: '1, knotted' },
    { id: 'salt', name: 'Salt', note: 'a pinch' },
  ],
  steps: [
    {
      id: 'prepare',
      title: 'Prepare the bananas',
      instruction: 'Take the bananas and lay them on the board.',
      condition: { type: 'PLACE', threshold: 1 },
      memory: '“Choose them ripe, with freckled skins. Bonda pressed each one with her thumb.”',
    },
    {
      id: 'syrup',
      title: 'Make the syrup',
      instruction: 'Pour the gula melaka and water into the pan until it bubbles.',
      condition: { type: 'POUR', threshold: 1 },
      memory: '“Gula melaka — the smell of it melting could call the whole kampung to the door.”',
    },
    {
      id: 'add',
      title: 'Add the bananas',
      instruction: 'Gently place the bananas into the syrup.',
      condition: { type: 'PLACE', threshold: 1 },
      memory: '“Lay them in gently. Never drop — you will bruise them and break the sweetness.”',
    },
    {
      id: 'simmer',
      title: 'Simmer gently',
      instruction: 'Stir slowly with the spoon and let the syrup thicken.',
      condition: { type: 'STIR', threshold: 5 },
      memory: '“Low fire, slow hand. Rushing sugar only burns it — like rushing anything.”',
    },
    {
      id: 'glaze',
      title: 'Coat and glaze',
      instruction: 'Spoon the glossy syrup over the bananas until they shine.',
      condition: { type: 'GLAZE', threshold: 6 },
      memory: '“See them turn golden and glossy? That shine is the whole reward.”',
    },
    {
      id: 'serve',
      title: 'Serve',
      instruction: 'Plate the sira pisang, warm and glistening.',
      condition: { type: 'PLATE', threshold: 1 },
      memory: '“Warm, sweet, and shared after Maghrib. This was how the day was put to rest.”',
    },
  ],
  closing:
    '“Sweet things need patience most of all. You have a steady hand now, child. I am glad.” — Bonda',
};

// Season One, Episode Three: Nasi Lemak — fragrant coconut rice with sambal and
// its little companions. Reuses swirl / pour / steam / glaze / place / plate.
export const nasiLemak = {
  id: 'nasi-lemak',
  title: 'Nasi Lemak',
  subtitle: 'Coconut rice with sambal, ikan bilis, peanuts, egg and cucumber — the national comfort.',
  season: 1,
  episode: 3,
  ingredients: [
    { id: 'rice', name: 'Rice', note: '2 cups, washed' },
    { id: 'santan', name: 'Coconut milk', note: '1 cup' },
    { id: 'pandan', name: 'Pandan leaf', note: '1, knotted' },
    { id: 'sambal', name: 'Sambal', note: 'to taste' },
    { id: 'garnish', name: 'Ikan bilis, peanuts, egg, cucumber', note: 'to serve' },
  ],
  steps: [
    {
      id: 'wash',
      title: 'Wash the rice',
      instruction: 'Swirl the rice with your hand until the water runs clear.',
      condition: { type: 'SWIRL', threshold: 6 },
      memory: '“Nasi lemak begins the day. Wash the rice while the kettle sings.”',
    },
    {
      id: 'santan',
      title: 'Pour the santan',
      instruction: 'Pour the coconut milk over the rice until it just covers.',
      condition: { type: 'POUR', threshold: 1 },
      memory: '“Lemak means rich. The santan is why the whole street smells of breakfast.”',
    },
    {
      id: 'steam',
      title: 'Steam the rice',
      instruction: 'Cover with the lid and let it steam until fragrant and fluffy.',
      condition: { type: 'STEAM_TIME', threshold: 6 },
      memory: '“Add a knot of pandan under the lid. That green smell is childhood itself.”',
    },
    {
      id: 'sambal',
      title: 'Spoon on the sambal',
      instruction: 'Spoon the sambal over the rice, glossy and red.',
      condition: { type: 'GLAZE', threshold: 6 },
      memory: '“Everyone argues whose sambal is best. The right answer is always your mother’s.”',
    },
    {
      id: 'garnish',
      title: 'Add the garnish',
      instruction: 'Lay the ikan bilis, peanuts, egg and cucumber into the bowl.',
      condition: { type: 'PLACE', threshold: 1 },
      memory: '“Crunchy, salty, cool and sweet — a little of everything on one plate.”',
    },
    {
      id: 'serve',
      title: 'Serve',
      instruction: 'Shape the nasi lemak onto the banana leaf.',
      condition: { type: 'PLATE', threshold: 1 },
      memory: '“Wrapped in banana leaf for the road, or open on a plate at home. Either way — makan.”',
    },
  ],
  closing:
    '“Three dishes now. You could feed a whole family a proper morning. Bonda is proud.” — Bonda',
};

// Season One, Episode Four: Kuih Seri Muka — a two-layer steamed kuih, sticky
// glutinous rice below and silky pandan custard above. Reuses swirl / steam /
// press (glaze) / whisk (stir) / pour / plate.
export const seriMuka = {
  id: 'seri-muka',
  title: 'Kuih Seri Muka',
  subtitle: 'Glutinous rice below, silky pandan custard above — soft, fragrant, nostalgic.',
  season: 1,
  episode: 4,
  ingredients: [
    { id: 'rice', name: 'Glutinous rice', note: '2 cups' },
    { id: 'santan', name: 'Coconut milk', note: '1 cup' },
    { id: 'pandan', name: 'Pandan juice', note: '1 cup' },
    { id: 'egg', name: 'Eggs', note: '3' },
    { id: 'sugar', name: 'Sugar & flour', note: 'for the custard' },
  ],
  steps: [
    {
      id: 'wash',
      title: 'Rinse & soak the pulut',
      instruction: 'Swirl the glutinous rice until the water runs clear.',
      condition: { type: 'SWIRL', threshold: 6 },
      memory: '“Two layers, two patiences. The rice first — rinse it like you mean it.”',
    },
    {
      id: 'steam',
      title: 'Steam the pulut',
      instruction: 'Cover with the lid and steam the rice with coconut milk until sticky.',
      condition: { type: 'STEAM_TIME', threshold: 6 },
      memory: '“Sticky, not wet. The rice must hold together to carry the custard.”',
    },
    {
      id: 'press',
      title: 'Press it into the tray',
      instruction: 'Press the steamed rice down with the paddle into a firm, even layer.',
      condition: { type: 'GLAZE', threshold: 6 },
      memory: '“Press it flat and even — a crooked base makes a crooked heart, Bonda says.”',
    },
    {
      id: 'whisk',
      title: 'Whisk the pandan custard',
      instruction: 'Whisk the pandan custard in its bowl until smooth and green.',
      condition: { type: 'STIR', threshold: 5 },
      memory: '“Real pandan, squeezed by hand. The bottled green is a stranger in this kitchen.”',
    },
    {
      id: 'pour',
      title: 'Pour & steam',
      instruction: 'Pour the custard over the rice; it will steam into a silky top.',
      condition: { type: 'POUR', threshold: 1 },
      memory: '“Pour gently over the back of a spoon so the layers never quarrel.”',
    },
    {
      id: 'serve',
      title: 'Cool & slice',
      instruction: 'Let it set, then plate a neat green-topped square.',
      condition: { type: 'PLATE', threshold: 1 },
      memory: '“Let it cool fully before you cut — the wait is the last, hardest step.”',
    },
  ],
  closing:
    '“Two layers, set just right. That takes a patient hand — and you have one now.” — Bonda',
};

// Season One, Episode Five: Rendang Ayam Raya — the festive crown. Grind the
// rempah, toast it dark, coat the chicken, pour the santan, and reduce it low
// and slow until rich. Reuses stir / place / pour / glaze at a wok, with a
// second station (the stone mortar) for the rempah.
export const rendang = {
  id: 'rendang',
  title: 'Rendang Ayam',
  subtitle: 'A festive Hari Raya chicken rendang — fragrant rempah, creamy coconut, tender ayam.',
  season: 1,
  episode: 5,
  ingredients: [
    { id: 'chicken', name: 'Chicken', note: '1 whole, cut in pieces' },
    { id: 'santan', name: 'Coconut milk', note: '2 cups' },
    { id: 'kerisik', name: 'Kerisik', note: '½ cup toasted coconut' },
    { id: 'rempah', name: 'Rempah', note: 'shallots, garlic, ginger, galangal, lemongrass, chili' },
    { id: 'daun', name: 'Turmeric leaf & spices', note: 'plus salt & palm sugar' },
  ],
  steps: [
    {
      id: 'blend',
      title: 'Blend the rempah',
      instruction: 'Grind the aromatics in the lesung into a smooth, red rempah.',
      condition: { type: 'STIR', threshold: 6 },
      memory: '“The rempah is the soul. Pound it by hand — Bonda can always taste the blender.”',
    },
    {
      id: 'saute',
      title: 'Toast & sauté',
      instruction: 'Fry the rempah in the wok with the spices until fragrant and dark.',
      condition: { type: 'STIR', threshold: 6 },
      memory: '“Fry it slow until it turns dark and the whole kampung knows it is Raya.”',
    },
    {
      id: 'chicken',
      title: 'Add the chicken',
      instruction: 'Add the chicken and coat every piece in the spiced rempah.',
      condition: { type: 'PLACE', threshold: 1 },
      memory: '“Coat every piece. The chicken must wear the spice like its Raya best.”',
    },
    {
      id: 'santan',
      title: 'Pour the santan',
      instruction: 'Pour in the coconut milk and turmeric leaf; let it simmer.',
      condition: { type: 'POUR', threshold: 1 },
      memory: '“First-press santan, and the turmeric leaf — that smell IS Hari Raya.”',
    },
    {
      id: 'slowcook',
      title: 'Slow cook',
      instruction: 'Stir low and slow until the sauce thickens and darkens.',
      condition: { type: 'STIR', threshold: 8 },
      memory: '“Low fire, patient hand. Rendang is love you can taste the hours in.”',
    },
    {
      id: 'finish',
      title: 'Finish & serve',
      instruction: 'Fold in the kerisik until rich, thick and glossy — then serve.',
      condition: { type: 'GLAZE', threshold: 5 },
      memory: '“Kerisik last, for the deep nutty finish. Now — makan, and pass the ketupat.”',
    },
  ],
  closing:
    '“Rendang cannot be rushed. Neither can a life well cooked. Selamat Hari Raya, child.” — Bonda',
};

// Teasers — shown in the book but not yet cookable.
const soon = (id, title, subtitle, episode) => ({ id, title, subtitle, season: 1, episode, comingSoon: true, ingredients: [], steps: [], closing: '' });
export const cekodokPisangSoon = soon('cekodok-pisang', 'Cekodok Pisang', 'Mashed-banana fritters, crisp outside and soft within — the rainy-day snack.', 6);
export const ikanSinggangSoon = soon('ikan-singgang', 'Ikan Singgang', 'Fish poached in a sour turmeric broth — clean, tangy and healing.', 7);
export const nasiKerabuSoon = soon('nasi-kerabu', 'Nasi Kerabu', 'Blue rice with herbs, fish and sambal — a plateful of the east coast.', 8);

export const season1 = [
  pulutKuning, pisangSira, nasiLemak, seriMuka, rendang,
  cekodokPisangSoon, ikanSinggangSoon, nasiKerabuSoon,
];
