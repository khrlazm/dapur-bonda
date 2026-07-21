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

export const season1 = [pulutKuning];
