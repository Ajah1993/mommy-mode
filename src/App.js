import { useState, useMemo, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   mommy mode. — a single mom's command center
   Now with Supabase persistence — your data saves forever
   ═══════════════════════════════════════════════════════════════ */

// ─── Supabase Config ────────────────────────────────────────────
const SUPABASE_URL = "https://bjtwccwdethcdkblvglx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqdHdjY3dkZXRoY2RrYmx2Z2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTI3OTYsImV4cCI6MjA5MDQ2ODc5Nn0.lx9h3ytvo_gQV1JcAv_d50gqlv2jSJkdvXL17rp2uk4";

// Lightweight Supabase client (no SDK needed)
let _sbToken = null; // updated after login/signup

const sb = {
  getHeaders() {
    return {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${_sbToken || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };
  },
  async get(table, query = "") {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: this.getHeaders() });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  },
  async post(table, data) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: this.getHeaders(), body: JSON.stringify(data) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },
  async patch(table, query, data) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "PATCH", headers: this.getHeaders(), body: JSON.stringify(data) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },
  async del(table, query) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { method: "DELETE", headers: this.getHeaders() });
      return true;
    } catch { return false; }
  },
  async upsert(table, data) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...this.getHeaders(), "Prefer": "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify(data),
      });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  },
  auth: {
    async signup(email, password, displayName) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, data: { display_name: displayName || "" } }),
        });
        const data = await r.json();
        if (!r.ok) return { error: data };
        return data;
      } catch { return { error: { message: "Network error" } }; }
    },
    async login(email, password) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await r.json();
        if (!r.ok) return { error: data };
        return data;
      } catch { return { error: { message: "Network error" } }; }
    },
    async getUser(token) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
        });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    },
    async recover(email) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        return r.ok;
      } catch { return false; }
    },
  },
};

// ─── AI Config (server-side only) ───────────────────────────────
// AI meal and activity generation requires a backend. Add a serverless
// function or Supabase Edge Function that calls the Anthropic API,
// then wire it up in generateMeals / generateActivities below.

// ─── Theme ──────────────────────────────────────────────────────
const C = {
  bg: "#FDFAF6", surface: "#FFFFFF", card: "#FFFFFF",
  terra: "#C4725A", terraLight: "#F3E0D8",
  sage: "#6B9E7D", sageLight: "#E3F0E7",
  honey: "#D4A843", honeyLight: "#FDF4DD",
  sky: "#5B95B8", skyLight: "#E0EFF6",
  text: "#2D2A26", sub: "#7A7267", dim: "#B8AFA5",
  border: "#EDE8E1", cream: "#F7F2EB",
};

const TAGS = {
  protein: { letter: "P", bg: C.terraLight, color: C.terra },
  omega: { letter: "Ω", bg: C.skyLight, color: C.sky },
  fiber: { letter: "F", bg: C.sageLight, color: C.sage },
  probiotic: { letter: "B", bg: C.honeyLight, color: C.honey },
};

// ─── Meal Data (same 4 weeks) ───────────────────────────────────
const MEALS_BY_WEEK = {
  1: {
    Monday: { morning: { name: "Greek yogurt parfait with berries & chia", tags: ["probiotic","protein","omega","fiber"], time: "5m" }, midday: { name: "Salmon avocado wrap with spinach", tags: ["omega","protein","fiber"], time: "8m" }, evening: { name: "Lemon herb salmon, roasted broccoli & quinoa", tags: ["omega","protein","fiber"], time: "35m" }, snack: { name: "Apple slices with almond butter", tags: ["fiber","omega"] } },
    Tuesday: { morning: { name: "Overnight oats with banana & walnuts", tags: ["fiber","omega","protein"], time: "5m prep" }, midday: { name: "Turkey hummus veggie wrap", tags: ["protein","fiber"], time: "5m" }, evening: { name: "One-pot chicken vegetable rice bowl", tags: ["protein","fiber"], time: "30m" }, snack: { name: "Trail mix with dark chocolate", tags: ["fiber","omega"] } },
    Wednesday: { morning: { name: "Spinach mango smoothie bowl with hemp seeds", tags: ["probiotic","omega","fiber"], time: "5m" }, midday: { name: "Black bean corn quesadilla with salsa", tags: ["protein","fiber"], time: "8m" }, evening: { name: "Sheet pan lemon chicken & sweet potatoes", tags: ["protein","fiber"], time: "40m" }, snack: { name: "Celery with peanut butter", tags: ["protein","fiber"] } },
    Thursday: { morning: { name: "Avocado egg toast on whole wheat", tags: ["protein","fiber","omega"], time: "7m" }, midday: { name: "Lentil soup with crusty bread", tags: ["protein","fiber","probiotic"], time: "10m" }, evening: { name: "Baked cod with asparagus & couscous", tags: ["omega","protein","fiber"], time: "30m" }, snack: { name: "Berries with honey & granola", tags: ["fiber","probiotic"] } },
    Friday: { morning: { name: "Two-ingredient banana pancakes", tags: ["protein","fiber"], time: "10m" }, midday: { name: "Chicken Caesar salad wrap", tags: ["protein","fiber"], time: "5m" }, evening: { name: "Tofu veggie stir-fry with brown rice", tags: ["protein","fiber","probiotic"], time: "25m" }, snack: { name: "Yogurt tube & cheese stick", tags: ["probiotic","protein"] } },
    Saturday: { morning: { name: "Scrambled eggs with cheese & toast", tags: ["protein","fiber"], time: "8m" }, midday: { name: "Grilled cheese & tomato soup", tags: ["protein","probiotic"], time: "10m" }, evening: { name: "Homemade veggie pizza night", tags: ["protein","fiber","probiotic"], time: "30m" }, snack: { name: "Frozen banana bites with chocolate", tags: ["fiber"] } },
    Sunday: { morning: { name: "French toast sticks with maple syrup", tags: ["protein","fiber"], time: "10m" }, midday: { name: "Chicken noodle soup (batch cook)", tags: ["protein","fiber"], time: "35m" }, evening: { name: "Slow cooker pulled chicken tacos", tags: ["protein","fiber"], time: "4h+" }, snack: { name: "Rice cakes with sunflower seed butter", tags: ["fiber","protein"] } },
  },
  2: {
    Monday: { morning: { name: "Chia pudding with coconut & mango", tags: ["omega","fiber","probiotic"], time: "5m prep" }, midday: { name: "Mediterranean chickpea salad", tags: ["protein","fiber"], time: "10m" }, evening: { name: "Garlic butter shrimp with zucchini noodles", tags: ["omega","protein"], time: "20m" }, snack: { name: "Edamame with sea salt", tags: ["protein","fiber"] } },
    Tuesday: { morning: { name: "Cottage cheese bowl with peaches & granola", tags: ["probiotic","protein","fiber"], time: "3m" }, midday: { name: "Egg salad lettuce wraps", tags: ["protein","omega"], time: "10m" }, evening: { name: "Turkey meatballs with marinara & pasta", tags: ["protein","fiber"], time: "35m" }, snack: { name: "Sliced bell peppers with ranch", tags: ["fiber"] } },
    Wednesday: { morning: { name: "PB & banana smoothie with milk", tags: ["protein","fiber","probiotic"], time: "5m" }, midday: { name: "Tuna salad on whole wheat crackers", tags: ["omega","protein","fiber"], time: "8m" }, evening: { name: "Black bean enchiladas with rice", tags: ["protein","fiber","probiotic"], time: "35m" }, snack: { name: "Popcorn with nutritional yeast", tags: ["fiber"] } },
    Thursday: { morning: { name: "Egg muffins with spinach & cheese", tags: ["protein","probiotic"], time: "5m" }, midday: { name: "Leftover enchilada bowl", tags: ["protein","fiber","probiotic"], time: "3m" }, evening: { name: "Teriyaki salmon with broccoli & rice", tags: ["omega","protein","fiber"], time: "25m" }, snack: { name: "Banana with almond butter", tags: ["fiber","protein"] } },
    Friday: { morning: { name: "Waffles with strawberries", tags: ["fiber","protein"], time: "10m" }, midday: { name: "BLT with avocado on sourdough", tags: ["protein","fiber"], time: "8m" }, evening: { name: "Fish tacos with mango salsa", tags: ["omega","protein","fiber"], time: "25m" }, snack: { name: "Frozen yogurt bark pieces", tags: ["probiotic","fiber"] } },
    Saturday: { morning: { name: "Breakfast burrito with eggs & beans", tags: ["protein","fiber","probiotic"], time: "10m" }, midday: { name: "Mini bagel pizzas", tags: ["protein","probiotic"], time: "10m" }, evening: { name: "Chicken alfredo with broccoli", tags: ["protein","fiber","probiotic"], time: "30m" }, snack: { name: "Ants on a log", tags: ["fiber","protein"] } },
    Sunday: { morning: { name: "Yogurt & granola bar plate", tags: ["probiotic","fiber","protein"], time: "3m" }, midday: { name: "Loaded baked potato bar", tags: ["protein","fiber"], time: "55m" }, evening: { name: "One-pot pasta primavera", tags: ["fiber","protein"], time: "25m" }, snack: { name: "Cheese & crackers with grapes", tags: ["probiotic","protein"] } },
  },
  3: {
    Monday: { morning: { name: "PB banana toast with honey drizzle", tags: ["protein","fiber"], time: "5m" }, midday: { name: "Mason jar Greek salad", tags: ["probiotic","fiber"], time: "10m" }, evening: { name: "Honey garlic chicken thighs & green beans", tags: ["protein","fiber"], time: "35m" }, snack: { name: "String cheese & crackers", tags: ["probiotic","protein"] } },
    Tuesday: { morning: { name: "Berry blast smoothie with flax", tags: ["omega","fiber","probiotic"], time: "5m" }, midday: { name: "Ham & cheese pinwheels", tags: ["protein","fiber"], time: "8m" }, evening: { name: "Beef & broccoli with jasmine rice", tags: ["protein","fiber"], time: "30m" }, snack: { name: "Hummus with cucumber slices", tags: ["protein","fiber"] } },
    Wednesday: { morning: { name: "Cinnamon raisin oatmeal with pecans", tags: ["fiber","omega","protein"], time: "8m" }, midday: { name: "Caprese sandwich on ciabatta", tags: ["protein","probiotic"], time: "5m" }, evening: { name: "Stuffed bell peppers with turkey & rice", tags: ["protein","fiber"], time: "45m" }, snack: { name: "Apple chips with yogurt dip", tags: ["fiber","probiotic"] } },
    Thursday: { morning: { name: "Mini quiche cups (meal prep)", tags: ["protein","fiber"], time: "5m" }, midday: { name: "Chicken salad stuffed avocado", tags: ["protein","omega"], time: "10m" }, evening: { name: "Shrimp fried rice with peas & carrots", tags: ["omega","protein","fiber"], time: "20m" }, snack: { name: "Mixed nuts & dried cranberries", tags: ["omega","fiber"] } },
    Friday: { morning: { name: "Chocolate chip whole wheat pancakes", tags: ["fiber","protein"], time: "12m" }, midday: { name: "Veggie quesadilla with guacamole", tags: ["protein","fiber"], time: "8m" }, evening: { name: "Mac & cheese with hidden cauliflower", tags: ["protein","probiotic","fiber"], time: "35m" }, snack: { name: "Smoothie popsicles", tags: ["probiotic","fiber"] } },
    Saturday: { morning: { name: "Egg & cheese English muffin", tags: ["protein","fiber"], time: "7m" }, midday: { name: "Tomato soup with grilled cheese dippers", tags: ["probiotic","fiber"], time: "15m" }, evening: { name: "Taco bar night (build your own)", tags: ["protein","fiber"], time: "25m" }, snack: { name: "Watermelon cubes", tags: ["fiber"] } },
    Sunday: { morning: { name: "Blueberry muffins (batch bake)", tags: ["fiber","protein"], time: "30m" }, midday: { name: "Leftover taco salad bowl", tags: ["protein","fiber"], time: "5m" }, evening: { name: "Slow cooker pot roast with potatoes", tags: ["protein","fiber"], time: "6h" }, snack: { name: "Granola bites with coconut", tags: ["fiber","omega"] } },
  },
  4: {
    Monday: { morning: { name: "Açai bowl with banana & granola", tags: ["omega","fiber","probiotic"], time: "8m" }, midday: { name: "Chicken pesto wrap", tags: ["protein","fiber"], time: "8m" }, evening: { name: "Baked pesto salmon with roasted potatoes", tags: ["omega","protein","fiber"], time: "30m" }, snack: { name: "Dark chocolate & almonds", tags: ["omega","fiber"] } },
    Tuesday: { morning: { name: "Savory oatmeal with egg & cheese", tags: ["protein","fiber","probiotic"], time: "10m" }, midday: { name: "Asian sesame noodle salad", tags: ["fiber","protein"], time: "10m" }, evening: { name: "Chicken tikka masala with rice", tags: ["protein","probiotic"], time: "35m" }, snack: { name: "Mango slices with chili lime", tags: ["fiber"] } },
    Wednesday: { morning: { name: "Breakfast quesadilla with eggs", tags: ["protein","fiber"], time: "8m" }, midday: { name: "Minestrone soup with bread", tags: ["fiber","protein","probiotic"], time: "15m" }, evening: { name: "Lemon pepper chicken wings & coleslaw", tags: ["protein","fiber"], time: "40m" }, snack: { name: "Frozen grapes", tags: ["fiber"] } },
    Thursday: { morning: { name: "Pumpkin spice overnight oats", tags: ["fiber","omega","probiotic"], time: "5m prep" }, midday: { name: "Turkey & cranberry sandwich", tags: ["protein","fiber"], time: "5m" }, evening: { name: "Veggie lo mein with tofu", tags: ["protein","fiber"], time: "25m" }, snack: { name: "Cottage cheese with pineapple", tags: ["probiotic","protein"] } },
    Friday: { morning: { name: "Cinnamon roll baked oats", tags: ["fiber","protein"], time: "25m" }, midday: { name: "Southwest chicken salad", tags: ["protein","fiber"], time: "10m" }, evening: { name: "Homemade fish sticks with oven fries", tags: ["omega","protein","fiber"], time: "30m" }, snack: { name: "Energy balls (oat, PB, honey)", tags: ["protein","fiber"] } },
    Saturday: { morning: { name: "Dutch baby pancake with lemon", tags: ["protein","fiber"], time: "20m" }, midday: { name: "Chicken tortilla soup", tags: ["protein","fiber"], time: "25m" }, evening: { name: "Spaghetti & homemade meat sauce", tags: ["protein","fiber"], time: "40m" }, snack: { name: "Caramel apple slices", tags: ["fiber"] } },
    Sunday: { morning: { name: "Everything bagel with cream cheese & salmon", tags: ["omega","protein","probiotic"], time: "5m" }, midday: { name: "Leftover spaghetti bake", tags: ["protein","fiber"], time: "10m" }, evening: { name: "Slow cooker honey garlic meatballs", tags: ["protein","fiber"], time: "4h+" }, snack: { name: "PB & honey rice cakes", tags: ["protein","fiber"] } },
  },
};

// ─── Grocery Lists by Week ──────────────────────────────────────
const GROCERY_BY_WEEK = {
  1: {
    Produce: ["Mixed berries","Bananas","Avocados (2)","Baby spinach","Broccoli","Sweet potato","Asparagus","Mango","Apples","Celery","Lemon"],
    Protein: ["Salmon fillets (2)","Chicken breast","Cod fillet","Eggs (dozen)","Turkey deli slices","Firm tofu"],
    Dairy: ["Greek yogurt","Shredded cheese","Milk"],
    Grains: ["Quinoa","Whole wheat tortillas","Whole wheat bread","Couscous","Brown rice","Pizza dough"],
    Pantry: ["Chia seeds","Almond butter","Walnuts","Hummus","Canned lentils","Sunflower seed butter","Trail mix","Rice cakes","Peanut butter","Granola"],
  },
  2: {
    Produce: ["Mango","Zucchini","Cucumber","Bell peppers","Tomatoes","Broccoli","Avocado","Strawberries","Grapes","Peaches","Celery"],
    Protein: ["Shrimp","Salmon fillets","Chicken breast","Ground turkey","Canned tuna","Eggs (dozen)"],
    Dairy: ["Cottage cheese","Greek yogurt","Shredded cheese","Milk","Sour cream"],
    Grains: ["Pasta","Whole wheat crackers","Mini bagels","Sourdough bread","Tortillas","Rolled oats","Frozen waffles"],
    Pantry: ["Canned chickpeas","Canned black beans","Marinara sauce","Granola","Ranch dressing","Popcorn","Alfredo sauce","Nutritional yeast"],
  },
  3: {
    Produce: ["Green beans","Broccoli","Cucumber","Bell peppers (6)","Tomatoes","Potatoes","Watermelon","Mango","Apple"],
    Protein: ["Chicken thighs","Ground beef","Shrimp","Ground turkey","Eggs (dozen)","Ham deli slices"],
    Dairy: ["Shredded cheese","Greek yogurt","Milk","Mozzarella","Feta cheese"],
    Grains: ["Jasmine rice","Ciabatta bread","Whole wheat bread","English muffins","Taco shells"],
    Pantry: ["Peanut butter","Honey","Kalamata olives","Hummus","Pecans","Raisins","Canned tomatoes","Frozen cauliflower","Taco seasoning"],
  },
  4: {
    Produce: ["Bananas","Potatoes","Broccoli","Mango","Avocado","Lemon","Coleslaw mix","Grapes","Pineapple chunks"],
    Protein: ["Salmon fillets","Chicken breast","Chicken wings","Ground beef","Firm tofu","Eggs (dozen)"],
    Dairy: ["Cottage cheese","Cream cheese","Greek yogurt","Milk","Shredded cheese"],
    Grains: ["Everything bagels","Rolled oats","Lo mein noodles","Spaghetti","White rice","Frozen acai packets","Granola"],
    Pantry: ["Pesto sauce","Sesame oil","Soy sauce","Pumpkin puree","Cranberry sauce","Peanut butter","Honey","Olive oil","Fish breading mix"],
  },
};

// ─── Learning Data (compact helper) ─────────────────────────────
const mkLa = (t, d, du, m) => ({ title: t, desc: d, duration: du, materials: m });
const LEARN_WEEKS = {
  "2-3": {
    math: [
      [mkLa("Counting Snack Time","Count crackers or grapes together before eating. '1, 2, 3 grapes!'","5 min","Snacks"), mkLa("Shape Hunt","Walk around finding circles, squares, triangles. Name each shape.","10 min","None"), mkLa("Sorting Colors","Sort colored blocks or toys into piles by color.","10 min","Colored objects")],
      [mkLa("Big & Small Game","Gather pairs (big spoon/small spoon). 'Which is bigger?'","5 min","Household items"), mkLa("Stack & Count Blocks","Build a tower, count each block. 'One, two, three!'","10 min","Blocks"), mkLa("Finger Counting Songs","Sing '5 Little Monkeys' using fingers. Physical counting!","8 min","None")],
      [mkLa("One-to-One Matching","Line up 3 cups and 3 spoons. Match one spoon per cup.","5 min","Cups, spoons"), mkLa("Nature Count Walk","On a walk, count trees, flowers, dogs. Tally with fingers.","15 min","A walk"), mkLa("Fill & Dump Measuring","Fill cups in bath/sandbox. Use words: full, empty, more, less.","10 min","Cups, water")],
      [mkLa("Sticker Counting","Draw circles (1-5). Place that many stickers inside each.","10 min","Stickers, paper"), mkLa("Toy Line-Up","Line stuffed animals by size — smallest to biggest.","8 min","Stuffed animals"), mkLa("Pattern Stamping","Use 2 paint colors. Make patterns: red, blue, red, blue.","10 min","Paint, sponges")],
    ],
    reading: [
      [mkLa("Point & Say","During storytime, point to pictures. 'What's that?' Name everything.","10 min","Picture books"), mkLa("Nursery Rhyme Time","Sing 3 nursery rhymes with hand motions. Builds awareness!","10 min","None"), mkLa("Letter of the Day","Pick one letter. Find it on boxes, signs, books all day.","All day","None")],
      [mkLa("Story Basket","Put 3 toys in a basket. Make up a story starring them!","10 min","3 toys"), mkLa("Sound Safari","Walk around the house naming sounds. Fridge? Clock? Dog?","10 min","None"), mkLa("Bedtime Story Retell","After reading, ask 'who was in the story?' Any answer counts!","5 min","A picture book")],
      [mkLa("Sing the Alphabet","Sing ABCs slowly. Point to letters on a poster as you go.","5 min","ABC chart"), mkLa("Action Word Game","Say action words and do them: jump, clap, spin, stomp!","10 min","None"), mkLa("Animal Sound Game","Show animal pictures. 'What does a cow say?' Fun + vocab!","8 min","Animal cards")],
      [mkLa("Texture Book Touch","Use touch-and-feel books. Name textures: soft, rough, bumpy.","5 min","Touch-and-feel book"), mkLa("Photo Book Talk","Look through family photos. Name people, describe what's happening.","10 min","Photos"), mkLa("Color Word Walk","Go outside. Name colors of everything: blue sky, green grass.","10 min","A walk")],
    ],
    spelling: [
      [mkLa("Name Tracing","Write their name in big letters. Trace with finger, then crayons.","5 min","Paper, crayons"), mkLa("Sand Letters","Pour sand on a tray. Guide finger to draw A, B, C.","10 min","Tray, sand or salt")],
      [mkLa("Letter Magnets","Fridge magnets — name letters as you play. Spell MOM together.","10 min","Magnetic letters"), mkLa("Dot-to-Dot Letters","Write letters as dots. They connect them to form the letter.","10 min","Paper, markers")],
      [mkLa("Playdough Letters","Roll playdough snakes into letter shapes. Start with their name.","10 min","Playdough"), mkLa("Paint a Letter","Watercolor one big letter. Say its sound while painting.","10 min","Watercolors")],
      [mkLa("Body Letters","Make letter shapes with your body on the floor. 'Make a T!'","10 min","None"), mkLa("Letter Stamps","Stamp their name with alphabet stamps. Then stamp M-O-M.","10 min","Letter stamps, ink")],
    ],
    comprehension: [
      [mkLa("What Happened?","After a story, ask 'what happened to the bunny?' 1-word answers count!","5 min","Picture book"), mkLa("Feelings Check","Show characters. 'Is the bear happy or sad? How can you tell?'","5 min","Picture book")],
      [mkLa("Sequence Cards","Show 3 story pictures. Put them in order: first, next, last.","10 min","Cards"), mkLa("Act It Out","After reading, act out the story. You be one character, they be another.","10 min","None")],
      [mkLa("Silly or Real?","'Dogs can fly!' 'Fish live in water!' They say silly or real.","5 min","None"), mkLa("Picture Walk","Before reading, flip through pictures. 'What is this book about?'","5 min","New picture book")],
      [mkLa("Doesn't Belong","Show 3 things — two related, one not. 'Apple, banana, car?'","5 min","Objects"), mkLa("Finish My Sentence","'The cat sat on the ___.' Build prediction skills!","5 min","None")],
    ],
  },
  "4-5": {
    math: [
      [mkLa("Grocery Store Math","'We need 4 apples — count them into the bag!'","During shopping","Grocery trip"), mkLa("Dice Addition","Roll two dice. Count dots together. First to say total wins!","15 min","2 dice"), mkLa("Pattern Bracelets","String beads: red-blue-red-blue. 'What comes next?'","15 min","Beads, string")],
      [mkLa("Coin Sorting","Sort coins by type. Count each pile. Intro to money!","10 min","Coins"), mkLa("Measuring Chef","Let them pour ingredients. 'We need 2 cups — count!'","During cooking","Measuring cups"), mkLa("Number Bingo","Bingo cards with 1-20. Call numbers — they cover them.","15 min","Paper, markers")],
      [mkLa("Skip Counting Walk","Walk and count every other stone by 2s: 2, 4, 6, 8!","10 min","A walk"), mkLa("Shape Pizza","Cut paper shapes to 'build' a pizza: circle, triangles, squares.","15 min","Paper, scissors"), mkLa("How Many Steps?","Guess steps to the kitchen, then count. Compare!","5 min","None")],
      [mkLa("Clock Craft","Paper plate clock with movable hands. 'Show me 3 o'clock.'","15 min","Paper plate, brad"), mkLa("Addition Snacks","3 goldfish here + 2 there. 'How many together?' Eat the answer!","10 min","Snacks"), mkLa("Taller or Shorter","Line up family members or toys by height. Measure with blocks.","10 min","Blocks")],
    ],
    reading: [
      [mkLa("Rhyme Battle","Take turns rhyming. 'Cat — hat — bat — sat!' Get stuck = pick next word.","10 min","None"), mkLa("Sight Word Hunt","Hide 5 sight words on sticky notes. Find and read aloud!","15 min","Sticky notes"), mkLa("Story Starters","'Once upon a time, a dragon went to…' They finish it!","15 min","Paper, crayons")],
      [mkLa("Label the House","Sticky note labels on items: DOOR, BED, CUP. Read all day.","10 min","Sticky notes"), mkLa("Word Family Flowers","Flower center = '-at'. Petals: cat, bat, hat, mat, sat.","10 min","Paper"), mkLa("Read the Recipe","Point to simple recipe words while cooking. They try to read!","During cooking","Simple recipe")],
      [mkLa("Sound Treasure Hunt","'Find something that starts with /b/!' They bring items.","10 min","None"), mkLa("Puppet Reading","Sock puppets 'read' a story. Different voices for each!","15 min","Socks"), mkLa("Sign Reading Walk","Walk the neighborhood reading signs: STOP, OPEN, EXIT.","15 min","A walk")],
      [mkLa("Morning Message","Write a message daily: 'Today is Tuesday. We go to the park.'","5 min","Whiteboard"), mkLa("I Spy Letters","'I spy the letter that makes /sss/!' They find S on the page.","10 min","Any book"), mkLa("Create a Menu","Pretend restaurant — write/draw a menu. Read orders back!","15 min","Paper, crayons")],
    ],
    spelling: [
      [mkLa("Playdough Letters","Roll playdough snakes to spell 3-letter words: CAT, DOG, SUN.","15 min","Playdough"), mkLa("Letter Hop","Letters on paper plates. Call a letter — hop to it! Spell by hopping.","15 min","Paper plates")],
      [mkLa("Bath Letters","Foam bath letters spell words on tub wall. ARM, LEG, EAR.","During bath","Foam letters"), mkLa("Spelling Clap","Clap each letter of their name. Then try other words!","5 min","None")],
      [mkLa("Sticker Spelling","Write a word big. Place stickers on each letter while saying it.","10 min","Stickers"), mkLa("Magnetic Word Builder","Fridge magnets to build CVC words: HOP, RUN. Swap letters!","10 min","Magnetic letters")],
      [mkLa("Chalk Spelling","Sidewalk chalk giant words. Walk on each letter saying it.","15 min","Sidewalk chalk"), mkLa("Word Fishing","Letters on paper fish with paperclips. Magnet rod to catch & spell.","15 min","Paper, magnets")],
    ],
    comprehension: [
      [mkLa("Predict What's Next","Pause mid-story. 'What happens next?' No wrong answers!","10 min","Storybook"), mkLa("Draw the Story","Draw favorite part after reading. Explain the drawing!","15 min","Paper, crayons")],
      [mkLa("Who, What, Where","After a story: 'WHO? WHAT did they do? WHERE?'","5 min","Storybook"), mkLa("Real Life Connection","'The bear was scared — have you felt scared? What did you do?'","5 min","Storybook")],
      [mkLa("Story Map","Draw: beginning → middle → end. Fill it in after reading.","10 min","Paper"), mkLa("Would You Rather?","From the book: 'Live in that castle or that forest? Why?'","5 min","None")],
      [mkLa("Retell with Props","Act out the story with toys as characters after reading.","10 min","Toys"), mkLa("Different Ending","'How would YOU end this story?' Builds creative thinking.","10 min","None")],
    ],
  },
  "6-7": {
    math: [
      [mkLa("Skip Counting Workout","Jumping jacks counting by 2s, 5s, or 10s!","10 min","None"), mkLa("Word Problem Theater","Act out: '8 cookies, give away 3 — how many left?'","15 min","Toys"), mkLa("Time Keeper","Tell time every hour. Practice quarter and half hours.","All day","Clock")],
      [mkLa("Math Fact War","Flip two cards — first to add them correctly wins!","15 min","Cards"), mkLa("Store Cashier","Pretend store with price tags. Calculate totals, make change.","20 min","Play money"), mkLa("Domino Addition","Pull a domino, add both sides. First to 50 wins!","15 min","Dominoes")],
      [mkLa("Measurement Hunt","Find something 6 inches long, 1 foot long. Check with ruler!","15 min","Ruler"), mkLa("Subtraction Bowling","10 bottles. Bowl. Subtract knocked down from 10.","20 min","Bottles, ball"), mkLa("Graph the Weather","Track weather for a week. Make a bar graph!","Ongoing","Paper")],
      [mkLa("Money Match","Show price tag. Count coins to match it exactly.","15 min","Coins, tags"), mkLa("Fact Family Houses","House roof = 3 numbers (3,5,8). Write all related facts.","10 min","Paper"), mkLa("Shape Area","Use square tiles to cover shapes. Count how many fit!","15 min","Square tiles")],
    ],
    reading: [
      [mkLa("Read to a Stuffed Animal","Read aloud to favorite toy. Fluency without pressure!","15 min","Easy reader books"), mkLa("Comic Creator","Fold paper into panels. Write/draw own comic with speech bubbles.","20 min","Paper, markers"), mkLa("Reading Bingo","Read in bed, outside, to sibling, a recipe. Complete a row!","Ongoing","Bingo card")],
      [mkLa("Vocabulary Jar","New word? Slip in the jar. Review weekly. Celebrate!","Ongoing","Jar, slips"), mkLa("Readers Theater","Each person reads a character's lines with expression!","15 min","Book with dialogue"), mkLa("Library Adventure","Pick a book from a genre they've never tried!","30 min","Library visit")],
      [mkLa("Poem of the Week","Read one poem daily. By Friday, recite it!","5 min/day","Poetry book"), mkLa("Word Detective","Word of the day — spot it in books, signs, menus.","All day","None"), mkLa("Reading Log Stickers","Track minutes read. Every 100 min = sticker!","Ongoing","Sticker chart")],
      [mkLa("Partner Reading","Take turns reading pages. Model fluency, they practice.","15 min","Any book"), mkLa("Book Recommendation Card","Write a tiny review on an index card.","10 min","Index card"), mkLa("Audiobook Follow-Along","Listen + follow in the book. Builds speed!","15 min","Audiobook + book")],
    ],
    spelling: [
      [mkLa("Rainbow Writing","Write each word in 3 different colors, tracing over each time.","10 min","Colored pencils"), mkLa("Spelling Hopscotch","Hopscotch with letters. Call a word — hop to each letter!","15 min","Chalk")],
      [mkLa("Secret Code","A=1, B=2. Give coded words to decode and spell.","15 min","Code sheet"), mkLa("Whiteboard Races","Say a word — who writes it correctly first?","10 min","Whiteboard")],
      [mkLa("Spelling Stairs","Build letter by letter: C, CA, CAT. Visual + memorable.","10 min","Paper"), mkLa("Shaving Cream Spelling","Write words in shaving cream on a tray. Sensory fun!","10 min","Shaving cream, tray")],
      [mkLa("Word Sort","Sort 12 word cards by pattern: 'th' words, 'sh' words.","10 min","Index cards"), mkLa("Spelling Tic-Tac-Toe","Spell correctly to place X or O. Strategy + spelling!","15 min","Paper")],
    ],
    comprehension: [
      [mkLa("Story Retell Chain","Take turns: you say one sentence, they say next.","10 min","Book"), mkLa("Character Interview","'If you could ask the character one question, what?'","10 min","Chapter book")],
      [mkLa("Compare Two Books","Read two similar books. 'Same? Different?' Critical thinking!","20 min","Two books"), mkLa("Main Idea Detective","'Explain this page in ONE sentence.' Builds summarizing.","10 min","Any book")],
      [mkLa("Cause & Effect Arrows","Draw: Because X → Y → Z happened. Visualize the plot.","10 min","Paper"), mkLa("Feelings Thermometer","Rate character feelings 1-10 at different story points.","10 min","Paper")],
      [mkLa("Text-to-Self","'Has this happened to you? How was it same or different?'","5 min","Book"), mkLa("Summary Sandwich","Top bread = topic, fillings = 3 details, bottom = conclusion.","10 min","Paper")],
    ],
  },
  "8-9": {
    math: [
      [mkLa("Fraction Pizza","Paper pizzas cut into halves, quarters, eighths. 'Eat 3/8 — how much left?'","20 min","Paper plates"), mkLa("Budget a Party","$50 pretend budget: food, decorations, games.","20 min","Paper"), mkLa("Multiplication Bingo","Bingo with products. Call '7×6' — cover the answer!","15 min","Bingo cards")],
      [mkLa("Recipe Doubler","Double a recipe together. Multiply fractions + whole numbers!","During cooking","Recipe"), mkLa("Decimal Shopping","Grocery flyer — calculate total for 5 items + tax.","15 min","Grocery flyer"), mkLa("Division Snacks","24 gummy bears ÷ 4 people. How many each?","10 min","Snacks")],
      [mkLa("Perimeter Walk","Measure room perimeters with tape. Which room is biggest?","20 min","Measuring tape"), mkLa("Times Table Karate","Karate pose. Say problem, they 'chop' and answer!","10 min","None"), mkLa("Pattern Block Art","Create designs. Count faces, find symmetry lines.","15 min","Pattern blocks")],
      [mkLa("Elapsed Time","'Movie at 2:15, ends 4:00. How long?' Use real schedules.","10 min","TV schedule"), mkLa("Graphing Survey","Survey family on favorites. Bar graph + calculate averages.","20 min","Paper"), mkLa("Fraction War","Cards as fractions. Bigger fraction wins the round!","15 min","Cards")],
    ],
    reading: [
      [mkLa("Book Club for Two","Same chapter book. Discuss over dinner like a real book club!","Ongoing","Chapter book"), mkLa("News Reporter","Read kids' news, 'report' it like a newscaster.","15 min","Kids news")],
      [mkLa("Genre Explorer","Different genre each week: mystery, fantasy, biography. Rate each!","Ongoing","Library books"), mkLa("Reading Response Journal","3 sentences: what happened, what you thought, what's next.","10 min","Journal")],
      [mkLa("Character Playlist","What songs would the character listen to? Explain each!","15 min","Paper"), mkLa("Nonfiction Jigsaw","Each read a different section, then teach the other.","20 min","Nonfiction book")],
      [mkLa("Book vs. Expectations","Before: 'What do you expect?' After: 'Were you right?'","5 min","New book"), mkLa("Letter to the Author","Write a short letter. What would you tell them?","15 min","Paper")],
    ],
    spelling: [
      [mkLa("Word Pyramids","Build: C → CA → CAT → CATS. How tall can it get?","10 min","Paper"), mkLa("Spelling Bee Practice","Real format: use in sentence, spell, use again.","15 min","Word list")],
      [mkLa("Root Word Detective","One prefix/suffix per week (un-, re-). Find words using it!","Ongoing","None"), mkLa("Spelling Word Stories","Write a story using all 10 spelling words. Underline each!","15 min","Paper")],
      [mkLa("Backwards Spelling","Spell words backwards. Start easy (CAT=TAC), get harder!","10 min","None"), mkLa("Crossword Maker","Create a crossword with vocab words. You solve it!","20 min","Graph paper")],
      [mkLa("Speed Spelling","Write words fast for 1 minute. Count correct. Beat your record!","10 min","Paper, timer"), mkLa("Scrabble Spelling","Spell with Scrabble tiles. Calculate point values for math bonus!","15 min","Scrabble tiles")],
    ],
    comprehension: [
      [mkLa("Evidence Finder","'How do you know they were nervous? Show me WHERE in the text.'","10 min","Chapter book"), mkLa("Theme Tracker","Track the theme on a poster as you read together.","Ongoing","Poster paper")],
      [mkLa("Cause & Effect Map","Draw arrows: Because X → Y → Z. Visualize the chain.","10 min","Paper"), mkLa("Mini Opinion Essay","Opinion + reason + conclusion about something from the book.","15 min","Paper")],
      [mkLa("Character Venn Diagram","Compare two characters. What's similar? Different?","15 min","Paper"), mkLa("Vocab in Context","3 unfamiliar words — guess from context, then check dictionary.","10 min","Book, dictionary")],
      [mkLa("Plot Mountain","Draw a mountain: intro, rising action, climax, falling, resolution.","15 min","Paper"), mkLa("Author's Purpose","'Persuade, inform, or entertain? How do you know?'","10 min","Any text")],
    ],
  },
  "10-12": {
    math: [
      [mkLa("Stock Market Game","Track $100 pretend investments in 3 companies for a week.","Ongoing","Paper, internet"), mkLa("Geometry Architect","Dream room on graph paper. Calculate area & perimeter.","30 min","Graph paper")],
      [mkLa("Tip & Tax Calculator","Calculate 15-20% tips and estimate tax on receipts.","At meals","Receipt"), mkLa("Data Collector","Survey + bar graph + averages. Present findings!","30 min","Paper")],
      [mkLa("Recipe Scaling","Scale a recipe for 4 to serve 7. Fraction multiplication!","20 min","Recipe"), mkLa("Speed & Distance","'Going 60 mph — how far in 45 minutes?'","During a drive","None")],
      [mkLa("Budget My Week","$25 for the week. Plan snacks, fun, savings.","15 min","Paper"), mkLa("Probability Games","Flip coins, roll dice. Predict vs. actual results.","20 min","Coins, dice")],
    ],
    reading: [
      [mkLa("Author Study","Read 2-3 books by same author. Compare style, themes.","Ongoing","Books"), mkLa("Debate Club","Topic from reading. Opposite sides. 5 min each!","15 min","None")],
      [mkLa("Annotate Like a Scholar","Sticky notes: star = important, ? = confusing, ! = surprising.","During reading","Sticky notes"), mkLa("Reading Podcast","Record 2-min book review 'podcast.' Play it back!","15 min","Phone")],
      [mkLa("Cross-Text Comparison","Two articles, same topic, different sources. How do they differ?","20 min","Two articles"), mkLa("Vocabulary Upgrade","Simple sentence → replace 3 words with stronger synonyms.","10 min","Thesaurus")],
      [mkLa("Book-to-Life Timeline","Book events alongside real world events from that era.","20 min","Paper, book"), mkLa("Genre Mash-Up","Rewrite a scene in a different genre (comedy, horror, sci-fi).","20 min","Paper")],
    ],
    spelling: [
      [mkLa("Etymology Explorer","Research a word's origin. Latin? Greek? Track in a journal.","15 min","Dictionary"), mkLa("Crossword Creator","Create crossword with vocabulary words. You solve it!","20 min","Graph paper")],
      [mkLa("Vocab in Context","3 unfamiliar words. Context clues → guess → check.","10 min","Book, journal"), mkLa("Morpheme Map","Break words: prefix + root + suffix. Map how meaning builds.","15 min","Paper")],
      [mkLa("Homophone Detective","There/their/they're — write sentences using each correctly.","10 min","Paper"), mkLa("Personal Dictionary","Track tricky misspelled words. Decorate it. Review weekly.","Ongoing","Notebook")],
      [mkLa("Word Analogies","Hot:cold as big:___. Create and solve word analogies.","10 min","Paper"), mkLa("Spelling Mnemonics","Create silly tricks: 'BECAUSE = Big Elephants Can Always...'","10 min","None")],
    ],
    comprehension: [
      [mkLa("Perspective Switch","Retell chapter from villain's POV. Builds empathy!","15 min","Chapter book"), mkLa("Book vs. Movie","Read book, watch movie. T-chart comparing. Which was better?","Ongoing","Book + movie")],
      [mkLa("Socratic Discussion","'Was the decision right? What would YOU do?' No right answers.","15 min","Chapter book"), mkLa("Thesis Builder","One statement about the message. Find 3 evidence pieces.","20 min","Book, paper")],
      [mkLa("Unreliable Narrator","'Can we trust this character? What might they leave out?'","10 min","Book"), mkLa("Symbolism Spotter","'What might the broken mirror symbolize?'","10 min","Book")],
      [mkLa("Create an Exam","They write 5 quiz questions. You take the quiz! Role reversal!","15 min","Paper"), mkLa("Letter Between Characters","Write a letter from one character to another.","15 min","Paper")],
    ],
  },
};

const BUDGET_ROWS = [
  { name: "Housing", color: C.terra, amt: 510 }, { name: "Utilities", color: C.sky, amt: 102 },
  { name: "Childcare", color: C.honey, amt: 340 }, { name: "Activities", color: C.sage, amt: 68 },
  { name: "Groceries", color: "#8CB369", amt: 204 }, { name: "Transport", color: "#D4A574", amt: 170 },
  { name: "Health", color: "#8BA4C7", amt: 51 }, { name: "Debt", color: "#999", amt: 0 },
  { name: "Misc", color: C.dim, amt: 51 },
];
const SPEND_CATS = ["Medical","Childcare","School","Activities","Clothing","Food","Transport","Other"];
const FEELINGS = [{ emoji: "🌟", label: "Great", color: C.honey }, { emoji: "🌿", label: "Good", color: C.sage }, { emoji: "☁️", label: "Okay", color: C.sky }, { emoji: "🌧️", label: "Low", color: C.sub }, { emoji: "🌪️", label: "Rough", color: C.terra }];
const AGE_RANGES = ["2-3","4-5","6-7","8-9","10-12"];
const SUBJECTS = ["math","reading","spelling","comprehension"];
const SUBJECT_META = { math: { icon: "✧", color: C.terra, label: "Math" }, reading: { icon: "❧", color: C.sage, label: "Reading" }, spelling: { icon: "✎", color: C.honey, label: "Spelling" }, comprehension: { icon: "◉", color: C.sky, label: "Comprehension" } };
const WEEK_DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const firstDow = (y, m) => new Date(y, m, 1).getDay();
const dk = (y, m, d) => `${y}-${m}-${d}`;

// ─── UI Primitives ──────────────────────────────────────────────
const Card = ({ children, style, onClick }) => (<div onClick={onClick} style={{ background: C.card, borderRadius: 16, padding: "16px 14px", boxShadow: "0 1px 4px rgba(45,42,38,0.06), 0 0 0 1px rgba(45,42,38,0.04)", ...style }}>{children}</div>);
const Lbl = ({ children, style }) => (<div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: C.sub, marginBottom: 6, ...style }}>{children}</div>);
const Btn = ({ children, onClick, color, outline, small, full, disabled, style: sx }) => (<button onClick={onClick} disabled={disabled} style={{ padding: small ? "5px 12px" : "9px 18px", borderRadius: 10, border: outline ? `1.5px solid ${color || C.terra}` : "none", background: outline ? "transparent" : (color || C.terra), color: outline ? (color || C.terra) : "#fff", fontSize: small ? 11 : 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", width: full ? "100%" : "auto", letterSpacing: 0.3, transition: "all 0.2s", opacity: disabled ? 0.5 : 1, ...sx }}>{children}</button>);
const Chip = ({ children, active, onClick, color }) => (<button onClick={onClick} style={{ padding: "5px 14px", borderRadius: 99, border: `1.5px solid ${active ? (color || C.terra) : C.border}`, background: active ? (color || C.terra) + "14" : "transparent", color: active ? (color || C.terra) : C.sub, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap" }}>{children}</button>);
const Field = ({ label, children }) => (<div><div style={{ fontSize: 10, fontWeight: 600, color: C.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>{children}</div>);
const Inp = (props) => (<input {...props} style={{ width: "100%", padding: "8px 10px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...props.style }} />);
const Sel = ({ children, ...props }) => (<select {...props} style={{ width: "100%", padding: "8px 10px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", ...props.style }}>{children}</select>);
const TagBadge = ({ tag }) => { const t = TAGS[tag]; return t ? (<span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, background: t.bg, color: t.color, fontSize: 10, fontWeight: 800 }}>{t.letter}</span>) : null; };

// ═══════════════════════════════════════════════════════════════
// MAIN APP WITH SUPABASE PERSISTENCE
// ═══════════════════════════════════════════════════════════════
export default function BloomApp() {
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // ── Auth state ──
  const [authUser, setAuthUser] = useState(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup" | "reset"
  const [authForm, setAuthForm] = useState({ email: "", password: "", displayName: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // ── State (same as before, but now loaded from DB) ──
  const [children, setChildren] = useState([{ id: "temp_initial", name: "", age: "" }]);
  const now = new Date();
  const currentWeekNum = now.getDate() <= 7 ? 1 : now.getDate() <= 14 ? 2 : now.getDate() <= 21 ? 3 : 4;
  const todayDateKey = dk(now.getFullYear(), now.getMonth(), now.getDate());
  const [cY, setCY] = useState(now.getFullYear());
  const [cM, setCM] = useState(now.getMonth());
  const [calNotes, setCalNotes] = useState({});
  const [calEvents, setCalEvents] = useState({});
  const [selDay, setSelDay] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [income, setIncome] = useState(1700);
  const [budget, setBudget] = useState(Object.fromEntries(BUDGET_ROWS.map(r => [r.name, r.amt])));
  const totalSpend = useMemo(() => Object.values(budget).reduce((a, b) => a + Number(b), 0), [budget]);
  const surplus = income - totalSpend;
  const [expenses, setExpenses] = useState([]);
  const [expForm, setExpForm] = useState({ child: "", category: "Medical", desc: "", amount: "", paidBy: "Me" });
  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ child: "", meals: { morning: "", midday: "", evening: "" }, feeling: "🌟", hw: false, bed: "20:00", note: "" });
  const [mealWeek, setMealWeek] = useState(currentWeekNum);
  const [mealDay, setMealDay] = useState("Monday");
  const [tagFilter, setTagFilter] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealEdits, setMealEdits] = useState({});
  const [learnAge, setLearnAge] = useState("4-5");
  const [learnSubject, setLearnSubject] = useState("math");
  const [learnWeek, setLearnWeek] = useState(currentWeekNum);
  const [completedActivities, setCompletedActivities] = useState({});
  const [addedToCalendar, setAddedToCalendar] = useState({});
  const [savedChildren, setSavedChildren] = useState({});
  const [celebratingChild, setCelebratingChild] = useState(null);

  // ── Grocery list state ──
  const [groceryList, setGroceryList] = useState([]);
  const [groceryWeek, setGroceryWeek] = useState(null);
  const [groceryView, setGroceryView] = useState(false);

  // ── Savings goals state ──
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [goalForm, setGoalForm] = useState({ name: "", target: "", current: "", emoji: "🌱" });
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // ── Self-care check-in state ──
  const [selfCareOpen, setSelfCareOpen] = useState(false);
  const [selfCareLog, setSelfCareLog] = useState([]);
  const [selfCareForm, setSelfCareForm] = useState({ mood: "🌿", note: "" });
  const todayCheckInKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayCheckIn = selfCareLog.find(l => l.date_key === todayCheckInKey);

  // ── Journal edit/delete state ──
  const [editingLog, setEditingLog] = useState(null);
  const [editLogForm, setEditLogForm] = useState({});

  // ── Expense edit & grocery save state ──
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expAddedToCalendar, setExpAddedToCalendar] = useState({});
  const [grocerySaved, setGrocerySaved] = useState(false);
  const [groceryNewItem, setGroceryNewItem] = useState("");
  const [editingGroceryId, setEditingGroceryId] = useState(null);

  // ── Custom learning activities state ──
  const [customActivities, setCustomActivities] = useState([]);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ title: "", desc: "", subject: "reading", duration: "20 min", materials: "None" });

  // ── Expandable grocery calendar events ──
  const [expandedGroceryEvents, setExpandedGroceryEvents] = useState({});

  // ── AI-generated content state ──
  const [generatedMeals, setGeneratedMeals] = useState({});     // { weekNum: { Monday: {morning,midday,evening,snack}, ... } }
  const [aiMealsSource, setAiMealsSource] = useState({});       // { weekNum: "ai" | "default" }
  const [aiMealsLoading, setAiMealsLoading] = useState(false);
  const [aiMealsError, setAiMealsError] = useState(null);
  const [generatedActivities, setGeneratedActivities] = useState({});  // { "ageRange-subject-week": [...] }
  const [aiActivitiesSource, setAiActivitiesSource] = useState({});
  const [aiActivitiesLoading, setAiActivitiesLoading] = useState(false);
  const [aiActivitiesError, setAiActivitiesError] = useState(null);

  // ── Check for existing session on mount ──
  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedToken = localStorage.getItem("mm_token");
        const storedUserId = localStorage.getItem("mm_user_id");
        console.log("[bloom] checkSession — mm_token:", storedToken ? "present" : "missing", "| mm_user_id:", storedUserId || "missing");
        if (storedToken) {
          const user = await sb.auth.getUser(storedToken);
          console.log("[bloom] getUser result:", user);
          if (user && user.id) {
            _sbToken = storedToken;
            setAuthUser(user);
            setProfileId(user.id);
            setLoading(true);
            await loadAllData(user.id);
            setLoading(false);
          } else {
            console.warn("[bloom] Stored token invalid — clearing localStorage");
            localStorage.removeItem("mm_token");
            localStorage.removeItem("mm_user_id");
          }
        }
      } catch (e) { console.error("[bloom] checkSession error:", e); }
      setAuthInitializing(false);
    };
    checkSession();
  }, []);

  // ── Load all data from Supabase ──
  const loadAllData = async (pid) => {
    const [dbChildren, dbLogs, dbNotes, dbEvents, dbBudget, dbExpenses, dbMealEdits, dbLearnProgress, dbGrocery, dbGoals, dbSelfCare, dbCustomActivities] = await Promise.all([
      sb.get("children", `profile_id=eq.${pid}&order=created_at.asc`),
      sb.get("journal_entries", `profile_id=eq.${pid}&order=created_at.desc`),
      sb.get("calendar_notes", `profile_id=eq.${pid}`),
      sb.get("calendar_events", `profile_id=eq.${pid}`),
      sb.get("budget", `profile_id=eq.${pid}`),
      sb.get("expenses", `profile_id=eq.${pid}&order=created_at.desc`),
      sb.get("meal_edits", `profile_id=eq.${pid}`),
      sb.get("learning_progress", `profile_id=eq.${pid}`),
      sb.get("grocery_list", `profile_id=eq.${pid}&order=created_at.asc`),
      sb.get("savings_goals", `profile_id=eq.${pid}&order=created_at.asc`),
      sb.get("selfcare_checkins", `profile_id=eq.${pid}&order=created_at.desc`),
      sb.get("custom_activities", `profile_id=eq.${pid}&order=created_at.asc`),
    ]);

    // Children
    if (dbChildren?.length > 0) {
      setChildren(dbChildren.map(c => ({ id: c.id, name: c.name || "", age: String(c.age || "") })));
      const saved = {};
      dbChildren.forEach(c => { if (c.name) saved[c.id] = true; });
      setSavedChildren(saved);
    }

    // Journal logs
    if (dbLogs?.length > 0) {
      setLogs(dbLogs.map(l => {
        const createdAt = new Date(l.created_at || l.date || Date.now());
        return {
          id: l.id, child: l.child_name,
          date: createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          date_key: dk(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()),
          meals: { morning: l.meal_morning || "", midday: l.meal_midday || "", evening: l.meal_evening || "" },
          feeling: l.feeling || "🌟", hw: l.homework_done, bed: l.bedtime || "20:00", note: l.note || "",
        };
      }));
    }

    // Calendar notes → grouped by date_key
    if (dbNotes?.length > 0) {
      const grouped = {};
      dbNotes.forEach(n => {
        if (!grouped[n.date_key]) grouped[n.date_key] = [];
        grouped[n.date_key].push({ text: n.text, id: n.id, done: n.done });
      });
      setCalNotes(grouped);
    }

    // Calendar events → grouped by date_key
    if (dbEvents?.length > 0) {
      const grouped = {};
      dbEvents.forEach(e => {
        if (!grouped[e.date_key]) grouped[e.date_key] = [];
        grouped[e.date_key].push({ title: e.title, desc: e.description, duration: e.duration, materials: e.materials, id: e.id, type: e.event_type });
      });
      setCalEvents(grouped);
    }

    // Budget
    if (dbBudget?.length > 0) {
      const b = dbBudget[0];
      if (b.income) setIncome(Number(b.income));
      if (b.categories && typeof b.categories === "object") setBudget(b.categories);
    }

    // Expenses
    if (dbExpenses?.length > 0) {
      setExpenses(dbExpenses.map(e => {
        const createdAt = new Date(e.created_at || Date.now());
        return { id: e.id, child: e.child_name, category: e.category, desc: e.description, amount: Number(e.amount), paidBy: e.paid_by, date_key: dk(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()) };
      }));
    }

    // Meal edits
    if (dbMealEdits?.length > 0) {
      const edits = {};
      dbMealEdits.forEach(m => { edits[m.meal_key] = m.custom_name; });
      setMealEdits(edits);
    }

    // Learning progress
    if (dbLearnProgress?.length > 0) {
      const prog = {};
      dbLearnProgress.forEach(l => { prog[l.activity_key] = true; });
      setCompletedActivities(prog);
    }

    // Grocery list
    if (dbGrocery?.length > 0) {
      setGroceryList(dbGrocery.map(g => ({ id: g.id, category: g.category, item: g.item, checked: g.checked, week: g.week })));
      setGroceryWeek(dbGrocery[0].week);
    }

    // Savings goals
    if (dbGoals?.length > 0) {
      setSavingsGoals(dbGoals.map(g => ({ id: g.id, name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), emoji: g.emoji || "🌱" })));
    }

    // Self-care check-ins
    if (dbSelfCare?.length > 0) {
      setSelfCareLog(dbSelfCare.map(s => ({ id: s.id, mood: s.mood, note: s.note || "", date_key: s.date_key, created_at: s.created_at })));
    }

    // Custom activities
    if (dbCustomActivities?.length > 0) {
      setCustomActivities(dbCustomActivities.map(a => ({
        id: a.id, age_range: a.age_range, subject: a.subject, week: a.week,
        title: a.title, desc: a.description, duration: a.duration || "20 min", materials: a.materials || "None",
      })));
    }

    // AI-generated meals for this year
    const dbGenMeals = await sb.get("generated_meals", `profile_id=eq.${pid}&year=eq.${new Date().getFullYear()}&order=created_at.desc`);
    if (dbGenMeals?.length > 0) {
      const mealsMap = {}, srcMap = {};
      dbGenMeals.forEach(m => { if (!mealsMap[m.week_number]) { mealsMap[m.week_number] = m.meals; srcMap[m.week_number] = "ai"; } });
      setGeneratedMeals(mealsMap);
      setAiMealsSource(srcMap);
    }

    // AI-generated activities for this year
    const dbGenActs = await sb.get("generated_activities", `profile_id=eq.${pid}&year=eq.${new Date().getFullYear()}&order=created_at.desc`);
    if (dbGenActs?.length > 0) {
      const actsMap = {}, srcMap = {};
      dbGenActs.forEach(a => {
        const key = `${a.age_range}-${a.subject}-${a.week_number}`;
        if (!actsMap[key]) { actsMap[key] = a.activities; srcMap[key] = "ai"; }
      });
      setGeneratedActivities(actsMap);
      setAiActivitiesSource(srcMap);
    }
  };

  // ── Auth handlers ──
  const handleLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    const res = await sb.auth.login(authForm.email, authForm.password);
    console.log("[bloom] login response:", res);
    if (res.error || !res.access_token) {
      console.warn("[bloom] login failed — error:", res.error, "| has access_token:", !!res.access_token);
      setAuthError(res.error?.message || res.error?.error_description || "Invalid email or password. Please try again.");
      setAuthLoading(false);
      return;
    }
    _sbToken = res.access_token;
    localStorage.setItem("mm_token", res.access_token);
    localStorage.setItem("mm_user_id", res.user.id);
    console.log("[bloom] login success — mm_token and mm_user_id saved. user id:", res.user.id);
    setAuthUser(res.user);
    setProfileId(res.user.id);
    setLoading(true);
    setAuthLoading(false);
    await loadAllData(res.user.id);
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!authForm.email || !authForm.password) { setAuthError("Please fill in all fields."); return; }
    if (authForm.password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthError("");
    setAuthLoading(true);
    const res = await sb.auth.signup(authForm.email, authForm.password, authForm.displayName);
    console.log("[bloom] signup response:", res);
    if (res.error) {
      console.warn("[bloom] signup failed — error:", res.error);
      setAuthError(res.error?.message || "Signup failed. Please try again.");
      setAuthLoading(false);
      return;
    }
    if (res.access_token) {
      _sbToken = res.access_token;
      localStorage.setItem("mm_token", res.access_token);
      localStorage.setItem("mm_user_id", res.user.id);
      console.log("[bloom] signup success — mm_token and mm_user_id saved. user id:", res.user.id);
      setAuthUser(res.user);
      setProfileId(res.user.id);
      setLoading(true);
      setAuthLoading(false);
      await loadAllData(res.user.id);
      setLoading(false);
    } else {
      setAuthLoading(false);
      setAuthError("Almost there! Check your email to confirm your account, then sign in.");
      setAuthMode("login");
    }
  };

  const handleRecover = async () => {
    if (!authForm.email) { setAuthError("Please enter your email address."); return; }
    setAuthError("");
    setAuthLoading(true);
    const ok = await sb.auth.recover(authForm.email);
    setAuthLoading(false);
    if (ok) {
      setResetSent(true);
    } else {
      setAuthError("Couldn't send reset email. Please check the address and try again.");
    }
  };

  // ── AI generation ──
  const generateMeals = () => {
    setAiMealsError("AI-powered meals coming soon! Using curated meal plans for now.");
    setTimeout(() => setAiMealsError(null), 5000);
  };

  const generateActivities = () => {
    setAiActivitiesError("AI-powered activities coming soon! Using curated activities for now.");
    setTimeout(() => setAiActivitiesError(null), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem("mm_token");
    localStorage.removeItem("mm_user_id");
    _sbToken = null;
    setAuthUser(null);
    setProfileId(null);
    setAuthForm({ email: "", password: "", displayName: "" });
    setAuthError("");
    setAuthMode("login");
    // Reset all app state
    setChildren([{ id: "temp_initial", name: "", age: "" }]);
    setLogs([]);
    setCalNotes({});
    setCalEvents({});
    setIncome(1700);
    setBudget(Object.fromEntries(BUDGET_ROWS.map(r => [r.name, r.amt])));
    setExpenses([]);
    setMealEdits({});
    setCompletedActivities({});
    setAddedToCalendar({});
    setSavedChildren({});
    setGroceryList([]);
    setGroceryWeek(null);
    setSavingsGoals([]);
    setSelfCareLog([]);
    setGeneratedMeals({});
    setAiMealsSource({});
    setGeneratedActivities({});
    setAiActivitiesSource({});
  };

  // ── Computed values ──
  const numDays = daysIn(cY, cM);
  const first = firstDow(cY, cM);
  const monthLabel = new Date(cY, cM).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const childNames = children.filter(c => c.name.trim()).map(c => c.name.trim());
  const getChildAgeRange = (age) => { const a = parseInt(age); if (isNaN(a)) return null; if (a<=3) return "2-3"; if (a<=5) return "4-5"; if (a<=7) return "6-7"; if (a<=9) return "8-9"; return "10-12"; };
  const getMeal = (day, slot) => {
    const k = `${mealWeek}-${day}-${slot}`;
    const base = generatedMeals[mealWeek]?.[day]?.[slot] || MEALS_BY_WEEK[mealWeek]?.[day]?.[slot] || null;
    if (!base) return null;
    return mealEdits[k] ? { ...base, name: mealEdits[k] } : base;
  };

  // ═══════════════════════════════════════════════════════════
  // DATABASE-SYNCED ACTIONS
  // ═══════════════════════════════════════════════════════════

  const saveChild = async (childId) => {
    const child = children.find(c => c.id === childId);
    if (!child || !profileId) return;
    // Trigger celebration FIRST
    setSavedChildren(p => ({ ...p, [childId]: true }));
    setCelebratingChild(childId);
    // Save to DB in background
    const isTemp = String(childId).startsWith("temp_") || typeof childId === "number";
    let newId = childId;
    if (isTemp) {
      const res = await sb.post("children", { profile_id: profileId, name: child.name, age: parseInt(child.age) || 0 });
      if (res?.[0]?.id) newId = res[0].id;
    } else {
      await sb.patch("children", `id=eq.${childId}`, { name: child.name, age: parseInt(child.age) || 0 });
    }
    // Wait for celebration to finish BEFORE swapping the ID
    setTimeout(() => {
      setCelebratingChild(null);
      if (newId !== childId) {
        setChildren(p => p.map(c => c.id === childId ? { ...c, id: newId } : c));
        setSavedChildren(p => { const n = { ...p }; delete n[childId]; n[newId] = true; return n; });
      }
    }, 1800);
  };

  const addChildSlot = () => {
    const newId = "temp_" + Date.now();
    setChildren(p => [...p, { id: newId, name: "", age: "" }]);
  };

  const removeChild = async (childId) => {
    setChildren(p => p.filter(c => c.id !== childId));
    if (profileId && !String(childId).startsWith("temp_")) {
      await sb.del("children", `id=eq.${childId}`);
    }
  };

  const addLog = async () => {
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const localLog = { ...logForm, id: Date.now(), date: dateStr, date_key: todayDateKey };
    setLogs(p => [localLog, ...p]);
    // Sync journal to calendar
    const todayKey = dk(now.getFullYear(), now.getMonth(), now.getDate());
    const calEntry = { title: `Journal: ${logForm.child || "Entry"}`, desc: `${logForm.feeling} ${logForm.meals.morning ? "Meals: " + [logForm.meals.morning, logForm.meals.midday, logForm.meals.evening].filter(Boolean).join(", ") : ""}${logForm.note ? " — " + logForm.note : ""}`, duration: "Daily log", materials: `HW: ${logForm.hw ? "Done" : "No"} · Bed: ${logForm.bed}`, id: Date.now() + 1, type: "journal" };
    setCalEvents(p => ({ ...p, [todayKey]: [...(p[todayKey] || []), calEntry] }));
    setLogOpen(false);
    if (profileId) {
      const dbLog = await sb.post("journal_entries", { profile_id: profileId, child_name: logForm.child, meal_morning: logForm.meals.morning, meal_midday: logForm.meals.midday, meal_evening: logForm.meals.evening, feeling: logForm.feeling, homework_done: logForm.hw, bedtime: logForm.bed, note: logForm.note });
      if (dbLog?.[0]?.id) setLogs(p => p.map((l, i) => i === 0 ? { ...l, id: dbLog[0].id } : l));
      await sb.post("calendar_events", { profile_id: profileId, date_key: todayKey, title: calEntry.title, description: calEntry.desc, duration: calEntry.duration, materials: calEntry.materials, event_type: "journal" });
    }
  };

  const addNoteToDay = async () => {
    if (!noteInput.trim() || !selDay) return;
    const k = dk(cY, cM, selDay);
    const localNote = { text: noteInput.trim(), id: Date.now(), done: false };
    setCalNotes(p => ({ ...p, [k]: [...(p[k] || []), localNote] }));
    setNoteInput("");
    if (profileId) {
      const res = await sb.post("calendar_notes", { profile_id: profileId, date_key: k, text: localNote.text, done: false });
      if (res?.[0]?.id) {
        setCalNotes(p => ({ ...p, [k]: p[k].map(n => n.id === localNote.id ? { ...n, id: res[0].id } : n) }));
      }
    }
  };

  const toggleNoteStatus = async (dayKey, noteId) => {
    let newDone;
    setCalNotes(p => {
      const updated = { ...p, [dayKey]: p[dayKey].map(n => { if (n.id === noteId) { newDone = !n.done; return { ...n, done: newDone }; } return n; }) };
      return updated;
    });
    if (profileId) await sb.patch("calendar_notes", `id=eq.${noteId}`, { done: newDone });
  };

  const deleteNote = async (dayKey, noteId) => {
    setCalNotes(p => ({ ...p, [dayKey]: p[dayKey].filter(n => n.id !== noteId) }));
    if (profileId) await sb.del("calendar_notes", `id=eq.${noteId}`);
  };

  const addActivityToCalendar = async (activity, actKey) => {
    const todayKey = dk(now.getFullYear(), now.getMonth(), now.getDate());
    const targetKey = selDay ? dk(cY, cM, selDay) : todayKey;
    const existing = calEvents[targetKey] || [];
    if (existing.some(e => e.title === activity.title)) {
      setAddedToCalendar(p => ({ ...p, [actKey]: "already" }));
      setTimeout(() => setAddedToCalendar(p => ({ ...p, [actKey]: null })), 2500);
      return;
    }
    const localEvt = { ...activity, id: Date.now(), type: "learning" };
    setCalEvents(p => ({ ...p, [targetKey]: [...(p[targetKey] || []), localEvt] }));
    setAddedToCalendar(p => ({ ...p, [actKey]: "added" }));
    setTimeout(() => setAddedToCalendar(p => ({ ...p, [actKey]: null })), 2500);
    if (profileId) {
      const res = await sb.post("calendar_events", { profile_id: profileId, date_key: targetKey, title: activity.title, description: activity.desc, duration: activity.duration, materials: activity.materials, event_type: "learning" });
      if (res?.[0]?.id) {
        setCalEvents(p => ({ ...p, [targetKey]: p[targetKey].map(e => e.id === localEvt.id ? { ...e, id: res[0].id } : e) }));
      }
    }
  };

  const deleteCalEvent = async (dayKey, eventId) => {
    setCalEvents(p => ({ ...p, [dayKey]: p[dayKey].filter(e => e.id !== eventId) }));
    if (profileId) await sb.del("calendar_events", `id=eq.${eventId}`);
  };

  const addExpense = async () => {
    if (!expForm.amount || !expForm.desc) return;
    if (editingExpenseId) {
      setExpenses(p => p.map(e => e.id === editingExpenseId ? { ...e, ...expForm, amount: parseFloat(expForm.amount) } : e));
      setEditingExpenseId(null);
      setExpForm(f => ({ ...f, desc: "", amount: "" }));
      if (profileId) await sb.patch("expenses", `id=eq.${editingExpenseId}`, { child_name: expForm.child, category: expForm.category, description: expForm.desc, amount: parseFloat(expForm.amount), paid_by: expForm.paidBy });
      return;
    }
    const localExp = { ...expForm, amount: parseFloat(expForm.amount), id: Date.now(), date_key: todayDateKey };
    setExpenses(p => [localExp, ...p]);
    setExpForm(f => ({ ...f, desc: "", amount: "" }));
    if (profileId) {
      const res = await sb.post("expenses", { profile_id: profileId, child_name: expForm.child, category: expForm.category, description: expForm.desc, amount: parseFloat(expForm.amount), paid_by: expForm.paidBy });
      if (res?.[0]?.id) setExpenses(p => p.map((e, i) => i === 0 ? { ...e, id: res[0].id } : e));
    }
  };

  // Budget auto-saves on change
  const budgetSaveTimeout = useRef(null);
  useEffect(() => {
    if (!profileId || loading) return;
    if (budgetSaveTimeout.current) clearTimeout(budgetSaveTimeout.current);
    budgetSaveTimeout.current = setTimeout(async () => {
      const existing = await sb.get("budget", `profile_id=eq.${profileId}`);
      if (existing?.length > 0) {
        await sb.patch("budget", `profile_id=eq.${profileId}`, { income, categories: budget, updated_at: new Date().toISOString() });
      } else {
        await sb.post("budget", { profile_id: profileId, income, categories: budget });
      }
    }, 1500);
  }, [income, budget, profileId, loading]);

  // Meal edit saves
  const saveMealEdit = async (key, value) => {
    setMealEdits(p => ({ ...p, [key]: value }));
    setEditingMeal(null);
    if (profileId) {
      await sb.upsert("meal_edits", { profile_id: profileId, meal_key: key, custom_name: value });
    }
  };

  // Learning progress toggle
  const toggleActivity = async (actKey) => {
    const isDone = completedActivities[actKey];
    setCompletedActivities(p => {
      const n = { ...p };
      if (isDone) delete n[actKey]; else n[actKey] = true;
      return n;
    });
    if (profileId) {
      if (isDone) {
        await sb.del("learning_progress", `profile_id=eq.${profileId}&activity_key=eq.${actKey}`);
      } else {
        await sb.post("learning_progress", { profile_id: profileId, activity_key: actKey });
      }
    }
  };

  // ── Custom activity actions ──
  const saveCustomActivity = async () => {
    if (!activityForm.title.trim()) return;
    const payload = {
      age_range: learnAge,
      subject: activityForm.subject,
      week: learnWeek,
      title: activityForm.title.trim(),
      description: activityForm.desc.trim(),
      duration: activityForm.duration || "20 min",
      materials: activityForm.materials || "None",
    };
    const local = { id: Date.now(), ...payload, desc: payload.description };
    setCustomActivities(p => [...p, local]);
    setActivityForm({ title: "", desc: "", subject: "reading", duration: "20 min", materials: "None" });
    setAddActivityOpen(false);
    if (profileId) {
      const res = await sb.post("custom_activities", { profile_id: profileId, ...payload, description: payload.description });
      if (res?.[0]?.id) {
        setCustomActivities(p => p.map(a => a.id === local.id ? { ...a, id: res[0].id } : a));
      }
    }
  };

  const deleteCustomActivity = async (act) => {
    setCustomActivities(p => p.filter(a => a.id !== act.id));
    const actKey = `custom-${act.id}`;
    setCompletedActivities(p => { const n = { ...p }; delete n[actKey]; return n; });
    if (profileId) {
      await sb.del("custom_activities", `id=eq.${act.id}`);
      await sb.del("learning_progress", `profile_id=eq.${profileId}&activity_key=eq.${actKey}`);
    }
  };

  // ── Grocery list actions ──
  const generateGroceryList = async (week) => {
    const raw = GROCERY_BY_WEEK[week] || {};
    const items = [];
    Object.entries(raw).forEach(([cat, list]) => {
      list.forEach(item => items.push({ category: cat, item, checked: false, week }));
    });
    setGroceryList(items);
    setGroceryWeek(week);
    setGroceryView(true);
    if (profileId) {
      await sb.del("grocery_list", `profile_id=eq.${profileId}`);
      const toInsert = items.map(i => ({ profile_id: profileId, category: i.category, item: i.item, checked: false, week }));
      const res = await sb.post("grocery_list", toInsert);
      if (res?.length) {
        setGroceryList(res.map(g => ({ id: g.id, category: g.category, item: g.item, checked: g.checked, week: g.week })));
      }
    }
  };

  const toggleGroceryItem = async (item) => {
    const newChecked = !item.checked;
    setGroceryList(p => p.map(g => {
      const match = item.id ? g.id === item.id : (g.category === item.category && g.item === item.item);
      return match ? { ...g, checked: newChecked } : g;
    }));
    if (profileId && item.id) await sb.patch("grocery_list", `id=eq.${item.id}`, { checked: newChecked });
  };

  const clearGroceryChecked = async () => {
    const toDelete = groceryList.filter(g => g.checked);
    setGroceryList(p => p.filter(g => !g.checked));
    if (profileId) {
      for (const g of toDelete) {
        if (g.id) await sb.del("grocery_list", `id=eq.${g.id}`);
      }
    }
  };

  // ── Savings goals actions ──
  const saveGoal = async () => {
    if (!goalForm.name || !goalForm.target) return;
    const local = { id: Date.now(), name: goalForm.name, target: parseFloat(goalForm.target), current: parseFloat(goalForm.current || 0), emoji: goalForm.emoji };
    setSavingsGoals(p => [...p, local]);
    setGoalForm({ name: "", target: "", current: "", emoji: "🌱" });
    setAddingGoal(false);
    if (profileId) {
      const res = await sb.post("savings_goals", { profile_id: profileId, name: local.name, target_amount: local.target, current_amount: local.current, emoji: local.emoji });
      if (res?.[0]?.id) setSavingsGoals(p => p.map(g => g.id === local.id ? { ...g, id: res[0].id } : g));
    }
  };

  const updateGoalAmount = async (goalId, newAmount) => {
    setSavingsGoals(p => p.map(g => g.id === goalId ? { ...g, current: newAmount } : g));
    if (profileId) await sb.patch("savings_goals", `id=eq.${goalId}`, { current_amount: newAmount });
  };

  const deleteGoal = async (goalId) => {
    setSavingsGoals(p => p.filter(g => g.id !== goalId));
    if (profileId) await sb.del("savings_goals", `id=eq.${goalId}`);
  };

  // ── Self-care check-in actions ──
  const saveSelfCare = async () => {
    const existing = selfCareLog.find(l => l.date_key === todayCheckInKey);
    const entry = { mood: selfCareForm.mood, note: selfCareForm.note, date_key: todayCheckInKey };
    const moodLabel = FEELINGS.find(f => f.emoji === selfCareForm.mood)?.label || "";
    const calTitle = `Mama Check-in: ${selfCareForm.mood} ${moodLabel}`;
    const calDesc = selfCareForm.note ? `"${selfCareForm.note}"` : `Feeling ${moodLabel} today`;
    if (existing) {
      setSelfCareLog(p => p.map(l => l.date_key === todayCheckInKey ? { ...l, ...entry } : l));
      setCalEvents(p => {
        const updated = { ...p };
        const hasSC = (updated[todayDateKey] || []).some(e => e.type === "selfcare");
        if (hasSC) {
          updated[todayDateKey] = updated[todayDateKey].map(e => e.type === "selfcare" ? { ...e, title: calTitle, desc: calDesc } : e);
        } else {
          updated[todayDateKey] = [...(updated[todayDateKey] || []), { title: calTitle, desc: calDesc, duration: "Self-care", materials: selfCareForm.mood, id: Date.now(), type: "selfcare" }];
        }
        return updated;
      });
      if (profileId) await sb.patch("selfcare_checkins", `id=eq.${existing.id}`, entry);
    } else {
      const local = { id: Date.now(), ...entry };
      setSelfCareLog(p => [local, ...p]);
      const localCalEvt = { title: calTitle, desc: calDesc, duration: "Self-care", materials: selfCareForm.mood, id: Date.now() + 1, type: "selfcare" };
      setCalEvents(p => ({ ...p, [todayDateKey]: [...(p[todayDateKey] || []), localCalEvt] }));
      if (profileId) {
        const res = await sb.post("selfcare_checkins", { profile_id: profileId, ...entry });
        if (res?.[0]?.id) setSelfCareLog(p => p.map(l => l.id === local.id ? { ...l, id: res[0].id } : l));
        await sb.post("calendar_events", { profile_id: profileId, date_key: todayDateKey, title: calTitle, description: calDesc, duration: "Self-care", materials: selfCareForm.mood, event_type: "selfcare" });
      }
    }
    setSelfCareOpen(false);
  };

  // ── Journal edit/delete ──
  const startEditLog = (log) => {
    setEditingLog(log.id);
    setEditLogForm({ child: log.child, meals: { ...log.meals }, feeling: log.feeling, hw: log.hw, bed: log.bed, note: log.note });
  };

  const saveEditLog = async (logId) => {
    const f = editLogForm;
    setLogs(p => p.map(l => l.id === logId ? { ...l, ...f } : l));
    // Update calendar event for this entry
    const updatedDesc = `${f.feeling} ${f.meals.morning ? "Meals: " + [f.meals.morning, f.meals.midday, f.meals.evening].filter(Boolean).join(", ") : ""}${f.note ? " — " + f.note : ""}`;
    const updatedMaterials = `HW: ${f.hw ? "Done" : "No"} · Bed: ${f.bed}`;
    setCalEvents(p => {
      const updated = { ...p };
      Object.keys(updated).forEach(k => {
        updated[k] = updated[k].map(e => e.type === "journal" && e.title === `Journal: ${f.child || "Entry"}` ? { ...e, desc: updatedDesc, materials: updatedMaterials } : e);
      });
      return updated;
    });
    setEditingLog(null);
    if (profileId) {
      await sb.patch("journal_entries", `id=eq.${logId}`, { child_name: f.child, meal_morning: f.meals.morning, meal_midday: f.meals.midday, meal_evening: f.meals.evening, feeling: f.feeling, homework_done: f.hw, bedtime: f.bed, note: f.note });
    }
  };

  const deleteLog = async (logId, logChild) => {
    const log = logs.find(l => l.id === logId);
    setLogs(p => p.filter(l => l.id !== logId));
    // Remove matching journal calendar event
    setCalEvents(p => {
      const updated = { ...p };
      Object.keys(updated).forEach(k => {
        const before = updated[k].length;
        updated[k] = updated[k].filter(e => !(e.type === "journal" && e.title === `Journal: ${logChild || "Entry"}`));
        // Only remove one instance
        if (updated[k].length < before - 1) {
          // put one back if we removed too many
          const removed = p[k].find(e => e.type === "journal" && e.title === `Journal: ${logChild || "Entry"}`);
          if (removed) updated[k] = [...updated[k], removed];
        }
      });
      return updated;
    });
    if (profileId) {
      await sb.del("journal_entries", `id=eq.${logId}`);
    }
  };

  // ── Expense management ──
  const deleteExpense = async (expId) => {
    if (!window.confirm("Delete this expense?")) return;
    setExpenses(p => p.filter(e => e.id !== expId));
    if (profileId) await sb.del("expenses", `id=eq.${expId}`);
  };

  const startEditExpense = (exp) => {
    setExpForm({ child: exp.child || "", category: exp.category, desc: exp.desc, amount: String(exp.amount), paidBy: exp.paidBy || "Me" });
    setEditingExpenseId(exp.id);
  };

  const addExpenseToCalendar = async (exp) => {
    if (expAddedToCalendar[exp.id]) return;
    const targetKey = exp.date_key || todayDateKey;
    const title = `Expense: ${exp.desc} — $${exp.amount.toFixed(2)}`;
    const desc = `${exp.category}${exp.child ? ` · ${exp.child}` : ""}`;
    const localEvt = { title, desc, duration: exp.category, materials: exp.paidBy || "Me", id: Date.now(), type: "expense" };
    setCalEvents(p => ({ ...p, [targetKey]: [...(p[targetKey] || []), localEvt] }));
    setExpAddedToCalendar(p => ({ ...p, [exp.id]: true }));
    setTimeout(() => setExpAddedToCalendar(p => { const n = { ...p }; delete n[exp.id]; return n; }), 2500);
    if (profileId) await sb.post("calendar_events", { profile_id: profileId, date_key: targetKey, title, description: desc, duration: exp.category, materials: exp.paidBy || "Me", event_type: "expense" });
  };

  const saveGroceryRun = async () => {
    const checked = groceryList.filter(g => g.checked);
    if (checked.length === 0) return;
    const title = `Grocery Run — ${checked.length} item${checked.length !== 1 ? "s" : ""}`;
    const desc = checked.map(g => g.item).join(", ");
    const localEvt = { title, desc, duration: "Shopping", materials: `Week ${groceryWeek} list`, id: Date.now(), type: "grocery" };
    setCalEvents(p => ({ ...p, [todayDateKey]: [...(p[todayDateKey] || []), localEvt] }));
    setGrocerySaved(true);
    setTimeout(() => setGrocerySaved(false), 3000);
    if (profileId) await sb.post("calendar_events", { profile_id: profileId, date_key: todayDateKey, title, description: desc, duration: "Shopping", materials: `Week ${groceryWeek} list`, event_type: "grocery" });
  };

  const addCustomGroceryItem = async () => {
    if (!groceryNewItem.trim()) return;
    const tempKey = Date.now();
    const newItem = { category: "Custom", item: groceryNewItem.trim(), checked: false, week: groceryWeek, _tempKey: tempKey };
    setGroceryList(p => [...p, newItem]);
    setGroceryNewItem("");
    if (profileId) {
      const res = await sb.post("grocery_list", [{ profile_id: profileId, category: "Custom", item: newItem.item, checked: false, week: groceryWeek }]);
      if (res?.[0]?.id) setGroceryList(p => p.map(g => g._tempKey === tempKey ? { ...g, id: res[0].id, _tempKey: undefined } : g));
    }
  };

  const saveGroceryItemEdit = async (item, newName) => {
    if (!newName.trim()) { setEditingGroceryId(null); return; }
    const trimmed = newName.trim();
    setGroceryList(p => p.map(g => {
      const match = item.id ? g.id === item.id : (g.category === item.category && g.item === item.item);
      return match ? { ...g, item: trimmed } : g;
    }));
    setEditingGroceryId(null);
    if (profileId && item.id) await sb.patch("grocery_list", `id=eq.${item.id}`, { item: trimmed });
  };

  // ── Learning streak & subject progress (per age range) ──
  const getSubjectProgress = (ageRange) => {
    const progress = {};
    SUBJECTS.forEach(subject => {
      let total = 0, done = 0;
      [1,2,3,4].forEach(week => {
        const acts = LEARN_WEEKS[ageRange]?.[subject]?.[week - 1] || [];
        acts.forEach((_, i) => {
          total++;
          if (completedActivities[`${ageRange}-${subject}-${week}-${i}`]) done++;
        });
      });
      // Count custom activities for this ageRange + subject
      customActivities.filter(a => a.age_range === ageRange && a.subject === subject).forEach(a => {
        total++;
        if (completedActivities[`custom-${a.id}`]) done++;
      });
      progress[subject] = { total, done };
    });
    return progress;
  };

  const getStreak = (ageRange) => {
    const builtIn = Object.keys(completedActivities).filter(k => k.startsWith(ageRange + "-")).length;
    const custom = customActivities.filter(a => a.age_range === ageRange && completedActivities[`custom-${a.id}`]).length;
    return builtIn + custom;
  };

  const NAV = [{ id: "home", icon: "⌂", label: "Home" }, { id: "meals", icon: "✦", label: "Meals" }, { id: "learn", icon: "◈", label: "Learn" }, { id: "money", icon: "◇", label: "Money" }, { id: "calendar", icon: "▦", label: "Calendar" }];

  // ── Initializing / Loading screen ──
  if (authInitializing || loading) return (
    <div style={{ fontFamily: "'Nunito Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.terra }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ fontFamily: "'Lora', serif", fontSize: 32, fontWeight: 700 }}>mommy mode<span style={{ color: C.sage }}>.</span></div>
      <div style={{ fontSize: 14, color: C.sub, marginTop: 8, fontStyle: "italic" }}>loading your world...</div>
    </div>
  );

  // ── Auth screen ──
  if (!authUser) {
    const inp = (type, placeholder, key, opts = {}) => (
      <input
        type={type}
        placeholder={placeholder}
        value={authForm[key]}
        onChange={e => setAuthForm(f => ({ ...f, [key]: e.target.value }))}
        onKeyDown={e => { if (e.key === "Enter") { if (authMode === "login") handleLogin(); else if (authMode === "signup") handleSignup(); else handleRecover(); } }}
        style={{ width: "100%", padding: "12px 14px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: C.text, ...opts.style }}
      />
    );
    return (
      <div style={{ fontFamily: "'Nunito Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`* { box-sizing: border-box; } @keyframes fadeIn { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } } .auth-anim { animation: fadeIn 0.5s ease both; }`}</style>
        {/* Soft botanical background */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "45vh", background: `linear-gradient(155deg, ${C.terraLight} 0%, ${C.sageLight}50 55%, transparent 100%)`, zIndex: 0, pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: 0, right: 0, width: 200, height: 200, background: `radial-gradient(circle, ${C.honeyLight} 0%, transparent 70%)`, zIndex: 0, pointerEvents: "none" }} />

        <div className="auth-anim" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 40, fontWeight: 700, color: C.terra, lineHeight: 1 }}>mommy mode<span style={{ color: C.sage }}>.</span></div>
            <div style={{ fontSize: 15, color: C.sub, fontStyle: "italic", fontFamily: "'Lora', serif", marginTop: 8, letterSpacing: 0.3 }}>you're doing amazing, mama</div>
          </div>

          {/* Card */}
          <div style={{ background: C.surface, borderRadius: 22, padding: "28px 24px", boxShadow: `0 8px 32px rgba(196,114,90,0.12), 0 0 0 1px rgba(196,114,90,0.07)` }}>
            {authMode !== "reset" && (
              <div style={{ display: "flex", background: C.cream, borderRadius: 14, padding: 4, marginBottom: 24, gap: 4 }}>
                {[["login","Sign In"],["signup","New Account"]].map(([mode, label]) => (
                  <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(""); setResetSent(false); }} style={{ flex: 1, padding: "9px", borderRadius: 11, border: "none", background: authMode === mode ? C.surface : "transparent", color: authMode === mode ? C.terra : C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: authMode === mode ? "0 1px 6px rgba(0,0,0,0.09)" : "none", transition: "all 0.2s" }}>{label}</button>
                ))}
              </div>
            )}

            {authMode === "reset" ? (
              resetSent ? (
                <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
                  <div style={{ fontSize: 42, marginBottom: 14 }}>🌿</div>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.sage, fontWeight: 600, marginBottom: 8 }}>Check your inbox</div>
                  <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.5 }}>We sent a password reset link to your email. It may take a minute to arrive.</div>
                  <button onClick={() => { setAuthMode("login"); setResetSent(false); setAuthError(""); }} style={{ marginTop: 22, color: C.terra, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>← Back to sign in</button>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.text, marginBottom: 6, fontWeight: 600 }}>Reset your password</div>
                  <div style={{ fontSize: 13, color: C.sub, marginBottom: 22, lineHeight: 1.5 }}>Enter your email and we'll send you a link to reset your password.</div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Email address</div>
                    {inp("email", "your@email.com", "email")}
                  </div>
                  {authError && <div style={{ fontSize: 13, color: C.terra, marginBottom: 14, padding: "10px 14px", background: C.terraLight, borderRadius: 10, lineHeight: 1.4 }}>{authError}</div>}
                  <button onClick={handleRecover} disabled={authLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: C.terra, color: "#fff", fontSize: 14, fontWeight: 700, cursor: authLoading ? "default" : "pointer", fontFamily: "inherit", opacity: authLoading ? 0.7 : 1, transition: "opacity 0.2s" }}>{authLoading ? "Sending..." : "Send reset link"}</button>
                  <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ width: "100%", marginTop: 12, padding: "10px", color: C.sub, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>← Back to sign in</button>
                </>
              )
            ) : (
              <>
                {authMode === "signup" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Your name</div>
                    {inp("text", "What should we call you?", "displayName")}
                  </div>
                )}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Email address</div>
                  {inp("email", "your@email.com", "email")}
                </div>
                <div style={{ marginBottom: authMode === "login" ? 8 : 22 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 }}>Password{authMode === "signup" ? " (min. 6 characters)" : ""}</div>
                  {inp("password", authMode === "signup" ? "Create a password" : "Your password", "password")}
                </div>
                {authMode === "login" && (
                  <div style={{ textAlign: "right", marginBottom: 20 }}>
                    <button onClick={() => { setAuthMode("reset"); setAuthError(""); }} style={{ background: "none", border: "none", color: C.sky, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Forgot password?</button>
                  </div>
                )}
                {authError && <div style={{ fontSize: 13, color: C.terra, marginBottom: 14, padding: "10px 14px", background: C.terraLight, borderRadius: 10, lineHeight: 1.4 }}>{authError}</div>}
                <button
                  onClick={authMode === "login" ? handleLogin : handleSignup}
                  disabled={authLoading}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${C.terra}, #B5614A)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: authLoading ? "default" : "pointer", fontFamily: "inherit", opacity: authLoading ? 0.75 : 1, transition: "opacity 0.2s", letterSpacing: 0.3 }}
                >
                  {authLoading ? (authMode === "login" ? "Signing in..." : "Creating account...") : (authMode === "login" ? "Sign In ✦" : "Create Account ✦")}
                </button>
              </>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 24, color: C.dim, fontSize: 12, fontStyle: "italic", fontFamily: "'Lora', serif" }}>
            your safe space to plan, dream & thrive
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER (same UI, now wired to DB)
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'Nunito Sans', sans-serif", background: C.bg, minHeight: "100vh", maxWidth: 480, margin: "0 auto", paddingBottom: 90, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; } input[type="number"] { -moz-appearance: textfield; } ::selection { background: ${C.terra}30; } @keyframes slideUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } } .anim { animation: slideUp 0.3s ease both; } ::-webkit-scrollbar { display: none; } @keyframes popIn { 0% { transform:scale(0.85); opacity:0 } 60% { transform:scale(1.05) } 100% { transform:scale(1); opacity:1 } } .pop { animation: popIn 0.25s ease both; }
        @keyframes floatUp1 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(-20px,-40px) scale(0.3); opacity:0 } }
        @keyframes floatUp2 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(15px,-50px) scale(0.2); opacity:0 } }
        @keyframes floatUp3 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(25px,-35px) scale(0.4); opacity:0 } }
        @keyframes floatUp4 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(-15px,-55px) scale(0.2); opacity:0 } }
        @keyframes floatUp5 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(5px,-45px) scale(0.3); opacity:0 } }
        @keyframes floatUp6 { 0% { transform:translate(0,0) scale(1); opacity:1 } 100% { transform:translate(-25px,-30px) scale(0.4); opacity:0 } }
        @keyframes savedPop { 0% { transform:scale(0.8); opacity:0 } 40% { transform:scale(1.15) } 100% { transform:scale(1); opacity:1 } }
        .star-burst > span:nth-child(1) { animation: floatUp1 1.2s ease-out both; }
        .star-burst > span:nth-child(2) { animation: floatUp2 1.1s ease-out both; animation-delay: 0.05s; }
        .star-burst > span:nth-child(3) { animation: floatUp3 1.3s ease-out both; animation-delay: 0.1s; }
        .star-burst > span:nth-child(4) { animation: floatUp4 1.0s ease-out both; animation-delay: 0.08s; }
        .star-burst > span:nth-child(5) { animation: floatUp5 1.2s ease-out both; animation-delay: 0.15s; }
        .star-burst > span:nth-child(6) { animation: floatUp6 1.1s ease-out both; animation-delay: 0.03s; }
        .saved-badge { animation: savedPop 0.4s ease both; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ padding: "28px 20px 18px", background: `linear-gradient(180deg, ${C.terraLight}60 0%, ${C.bg} 100%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: C.terra }}>mommy mode<span style={{ color: C.sage }}>.</span></div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2, fontStyle: "italic", fontFamily: "'Lora', serif" }}>you're doing amazing, mama</div>
          </div>
          <button onClick={handleLogout} title="Sign out" style={{ marginTop: 6, background: "none", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "5px 12px", color: C.dim, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.3 }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: "0 14px" }}>
        {/* HOME */}
        {view === "home" && (<div className="anim">
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600 }}>My Littles</div><Btn small color={C.sage} onClick={addChildSlot}>+ Add child</Btn></div>
            {children.map((child, idx) => (<div key={child.id} style={{ position: "relative", display: "flex", gap: 10, alignItems: "center", marginBottom: 10, background: savedChildren[child.id] ? C.sageLight : C.cream, borderRadius: 12, padding: "10px 12px", border: savedChildren[child.id] ? `1.5px solid ${C.sage}40` : "1.5px solid transparent", transition: "all 0.3s" }}>
              {celebratingChild === child.id && (<div className="star-burst" style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 10 }}><span style={{ position: "absolute", fontSize: 18 }}>⭐</span><span style={{ position: "absolute", fontSize: 14 }}>✨</span><span style={{ position: "absolute", fontSize: 16 }}>🌟</span><span style={{ position: "absolute", fontSize: 12 }}>⭐</span><span style={{ position: "absolute", fontSize: 15 }}>✨</span><span style={{ position: "absolute", fontSize: 13 }}>🌟</span></div>)}
              <div style={{ width: 38, height: 38, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: savedChildren[child.id] ? [C.terra, C.sage, C.honey, C.sky][idx % 4] : [C.terraLight, C.sageLight, C.honeyLight, C.skyLight][idx % 4], color: savedChildren[child.id] ? "#fff" : [C.terra, C.sage, C.honey, C.sky][idx % 4], fontSize: 16, fontWeight: 800, flexShrink: 0, transition: "all 0.3s" }}>{child.name ? child.name[0].toUpperCase() : "?"}</div>
              <div style={{ flex: 1, display: "flex", gap: 8 }}><input placeholder="Child's name" value={child.name} onChange={(e) => { setChildren(p => p.map(c => c.id === child.id ? { ...c, name: e.target.value } : c)); if (savedChildren[child.id]) setSavedChildren(p => ({ ...p, [child.id]: false })); }} style={{ flex: 1, padding: "6px 10px", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.text }} /><input placeholder="Age" type="number" value={child.age} onChange={(e) => { setChildren(p => p.map(c => c.id === child.id ? { ...c, age: e.target.value } : c)); if (savedChildren[child.id]) setSavedChildren(p => ({ ...p, [child.id]: false })); }} style={{ width: 52, padding: "6px 8px", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", textAlign: "center", color: C.text }} /></div>
              {child.name.trim() && child.age ? (savedChildren[child.id] ? (<span className="saved-badge" style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 10px", borderRadius: 8, background: C.sage, color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓ Saved</span>) : (<button onClick={() => saveChild(child.id)} style={{ background: C.honey, border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", gap: 3 }}>✦ Save</button>)) : null}
              {children.length > 1 && <button onClick={() => removeChild(child.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>}
            </div>))}
            {children.some(c => !c.name.trim()) && <div style={{ fontSize: 11, color: C.honey, marginTop: 4, fontStyle: "italic" }}>↑ Add name & age, then hit Save to lock it in</div>}
          </Card>
          {/* Self-care mama check-in */}
          <Card style={{ marginBottom: 14, background: todayCheckIn ? C.honeyLight : C.surface, border: `1.5px solid ${todayCheckIn ? C.honey + "60" : C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: C.honey }}>How are you, mama? ✦</div>
                {todayCheckIn ? (<div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{todayCheckIn.mood} {FEELINGS.find(f => f.emoji === todayCheckIn.mood)?.label || ""}{todayCheckIn.note ? ` · "${todayCheckIn.note}"` : ""}</div>) : (<div style={{ fontSize: 12, color: C.dim, marginTop: 2, fontStyle: "italic" }}>No check-in yet today</div>)}
              </div>
              <Btn small color={C.honey} onClick={() => setSelfCareOpen(!selfCareOpen)}>{todayCheckIn ? "Update" : "Check in"}</Btn>
            </div>
            {selfCareOpen && (<div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} className="anim">
              <Field label="Your mood today"><div style={{ display: "flex", gap: 6, marginTop: 4 }}>{FEELINGS.map(f => (<button key={f.emoji} onClick={() => setSelfCareForm(p => ({ ...p, mood: f.emoji }))} style={{ padding: "6px 8px", borderRadius: 10, border: selfCareForm.mood === f.emoji ? `2px solid ${f.color}` : `1.5px solid ${C.border}`, background: selfCareForm.mood === f.emoji ? f.color + "18" : "transparent", fontSize: 18, cursor: "pointer" }}>{f.emoji}</button>))}</div></Field>
              <div style={{ marginTop: 10, marginBottom: 12 }}><Field label="Optional note"><textarea placeholder="Just for you — how's your heart today?" value={selfCareForm.note} onChange={e => setSelfCareForm(p => ({ ...p, note: e.target.value }))} rows={2} style={{ width: "100%", padding: "8px 10px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} /></Field></div>
              <Btn full color={C.honey} onClick={saveSelfCare}>Save check-in ✦</Btn>
            </div>)}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Card style={{ textAlign: "center", padding: 14, cursor: "pointer" }} onClick={() => setView("calendar")}><div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1 }}>Today's Activity</div><div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 700, color: C.terra, marginTop: 4 }}>{(calNotes[todayDateKey] || []).length + (calEvents[todayDateKey] || []).length}</div><div style={{ fontSize: 10, color: C.dim }}>tap to view</div></Card>
            <Card style={{ textAlign: "center", padding: 14, cursor: "pointer" }} onClick={() => setView("money")}><div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: "uppercase", letterSpacing: 1 }}>Surplus</div><div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 700, color: surplus >= 0 ? C.sage : C.terra, marginTop: 4 }}>{surplus >= 0 ? "+" : ""}${Math.abs(surplus)}</div><div style={{ fontSize: 10, color: C.dim }}>this month</div></Card>
          </div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600 }}>Daily Journal</div><Btn small color={C.terra} onClick={() => setLogOpen(!logOpen)}>+ Entry</Btn></div>
            {logOpen && (<div style={{ background: C.cream, borderRadius: 14, padding: 14, marginBottom: 14, border: `1.5px solid ${C.terra}30` }} className="anim">
              <div style={{ marginBottom: 10 }}><Field label="Child"><Sel value={logForm.child} onChange={e => setLogForm(f => ({ ...f, child: e.target.value }))}><option value="">Select</option>{childNames.map(n => <option key={n}>{n}</option>)}<option>All</option></Sel></Field></div>
              {["morning","midday","evening"].map(s => (<div key={s} style={{ marginBottom: 8 }}><Field label={s}><Inp placeholder="What'd they eat?" value={logForm.meals[s]} onChange={e => setLogForm(f => ({ ...f, meals: { ...f.meals, [s]: e.target.value } }))} /></Field></div>))}
              <div style={{ marginBottom: 10 }}><Field label="Mood"><div style={{ display: "flex", gap: 6, marginTop: 2 }}>{FEELINGS.map(f => (<button key={f.emoji} onClick={() => setLogForm(lf => ({ ...lf, feeling: f.emoji }))} style={{ padding: "6px 8px", borderRadius: 10, border: logForm.feeling === f.emoji ? `2px solid ${f.color}` : `1.5px solid ${C.border}`, background: logForm.feeling === f.emoji ? f.color + "18" : "transparent", fontSize: 18, cursor: "pointer" }}>{f.emoji}</button>))}</div></Field></div>
              <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "center" }}><label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.sub, cursor: "pointer" }}><input type="checkbox" checked={logForm.hw} onChange={e => setLogForm(f => ({ ...f, hw: e.target.checked }))} style={{ accentColor: C.terra }} /> Homework done</label><div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.sub }}>Bedtime <input type="time" value={logForm.bed} onChange={e => setLogForm(f => ({ ...f, bed: e.target.value }))} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12, fontFamily: "inherit", color: C.text }} /></div></div>
              <div style={{ marginBottom: 12 }}><Field label="Notes"><textarea placeholder="Anything to note..." value={logForm.note} onChange={e => setLogForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} /></Field></div>
              <Btn full color={C.terra} onClick={addLog}>Save Entry ✦</Btn>
            </div>)}
            {logs.filter(l => l.date_key === todayDateKey).length === 0 && !logOpen && <div style={{ textAlign: "center", padding: "16px 0", color: C.dim, fontSize: 13, fontStyle: "italic" }}>No entries today — tap past days on the Calendar to review previous logs.</div>}
            {logs.filter(l => l.date_key === todayDateKey).map(log => (<div key={log.id} style={{ background: C.cream, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
              {editingLog === log.id ? (
                <div className="anim">
                  <div style={{ marginBottom: 8 }}><Field label="Child"><Sel value={editLogForm.child} onChange={e => setEditLogForm(f => ({ ...f, child: e.target.value }))}><option value="">Select</option>{childNames.map(n => <option key={n}>{n}</option>)}<option>All</option></Sel></Field></div>
                  {["morning","midday","evening"].map(s => (<div key={s} style={{ marginBottom: 6 }}><Field label={s}><Inp placeholder="What'd they eat?" value={editLogForm.meals[s]} onChange={e => setEditLogForm(f => ({ ...f, meals: { ...f.meals, [s]: e.target.value } }))} /></Field></div>))}
                  <div style={{ marginBottom: 8 }}><Field label="Mood"><div style={{ display: "flex", gap: 6 }}>{FEELINGS.map(f => (<button key={f.emoji} onClick={() => setEditLogForm(lf => ({ ...lf, feeling: f.emoji }))} style={{ padding: "4px 6px", borderRadius: 8, border: editLogForm.feeling === f.emoji ? `2px solid ${f.color}` : `1.5px solid ${C.border}`, background: editLogForm.feeling === f.emoji ? f.color + "18" : "transparent", fontSize: 16, cursor: "pointer" }}>{f.emoji}</button>))}</div></Field></div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}><label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.sub, cursor: "pointer" }}><input type="checkbox" checked={editLogForm.hw} onChange={e => setEditLogForm(f => ({ ...f, hw: e.target.checked }))} style={{ accentColor: C.terra }} /> Homework done</label><div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.sub }}>Bed <input type="time" value={editLogForm.bed} onChange={e => setEditLogForm(f => ({ ...f, bed: e.target.value }))} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", fontSize: 12, fontFamily: "inherit", color: C.text }} /></div></div>
                  <div style={{ marginBottom: 10 }}><Field label="Notes"><textarea value={editLogForm.note} onChange={e => setEditLogForm(f => ({ ...f, note: e.target.value }))} rows={2} style={{ width: "100%", padding: "8px 10px", background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} /></Field></div>
                  <div style={{ display: "flex", gap: 8 }}><Btn color={C.terra} onClick={() => saveEditLog(log.id)}>Save</Btn><Btn outline color={C.sub} onClick={() => setEditingLog(null)}>Cancel</Btn></div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{log.child || "—"}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: C.dim }}>{log.date}</span>
                      <button onClick={() => startEditLog(log)} style={{ background: "none", border: "none", color: C.sky, cursor: "pointer", fontSize: 12, padding: "2px 4px", fontFamily: "inherit" }}>✎</button>
                      <button onClick={() => deleteLog(log.id, log.child)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>×</button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>{["morning","midday","evening"].map(s => (<div key={s} style={{ background: "#fff", borderRadius: 8, padding: "6px 8px" }}><div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.dim }}>{s}</div><div style={{ fontSize: 11, marginTop: 2 }}>{log.meals[s] || "—"}</div></div>))}</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.sub }}><span>{log.feeling} {FEELINGS.find(f => f.emoji === log.feeling)?.label}</span><span>HW: {log.hw ? "✓" : "—"}</span><span>Bed: {log.bed}</span></div>
                  {log.note && <div style={{ marginTop: 6, fontSize: 12, color: C.dim, fontStyle: "italic" }}>{log.note}</div>}
                </>
              )}
            </div>))}
          </Card>
        </div>)}

        {/* MEALS */}
        {view === "meals" && (<div className="anim">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600 }}>Meal Plans</div>
            <Btn small color={C.sage} onClick={() => { generateGroceryList(mealWeek); }}>🛒 Grocery list</Btn>
          </div>
          {/* AI generate row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <button
              onClick={generateMeals}
              disabled={aiMealsLoading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: `1.5px solid ${C.sky}`, background: aiMealsLoading ? C.skyLight : "transparent", color: C.sky, fontSize: 12, fontWeight: 700, cursor: aiMealsLoading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.2s", flexShrink: 0 }}
            >
              {aiMealsLoading
                ? <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${C.sky}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Generating...</>
                : "✦ Fresh Meals"}
            </button>
            {aiMealsSource[mealWeek] === "ai"
              ? <span style={{ fontSize: 10, color: C.sky, background: C.skyLight, padding: "3px 9px", borderRadius: 99, fontWeight: 700, border: `1px solid ${C.sky}40` }}>✦ AI-generated</span>
              : <span style={{ fontSize: 10, color: C.dim, background: C.cream, padding: "3px 9px", borderRadius: 99 }}>Default plan</span>}
          </div>
          {aiMealsError && <div style={{ marginBottom: 10, padding: "9px 12px", background: C.honeyLight, border: `1px solid ${C.honey}50`, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>⚠ {aiMealsError}</div>}

          {groceryView && groceryWeek === mealWeek && (() => {
            const cats = [...new Set(groceryList.map(g => g.category))];
            const checkedCount = groceryList.filter(g => g.checked).length;
            return (
              <Card style={{ marginBottom: 14, border: `1.5px solid ${C.sage}40` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: C.sage }}>Week {mealWeek} Groceries</div><div style={{ fontSize: 11, color: C.dim }}>{checkedCount}/{groceryList.length} checked off</div></div>
                  <div style={{ display: "flex", gap: 6 }}>{checkedCount > 0 && <Btn small outline color={C.dim} onClick={clearGroceryChecked}>Clear ✓</Btn>}<button onClick={() => setGroceryView(false)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 18, padding: 4 }}>×</button></div>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: C.cream, marginBottom: 12 }}><div style={{ height: "100%", width: `${groceryList.length ? (checkedCount / groceryList.length) * 100 : 0}%`, borderRadius: 99, background: `linear-gradient(90deg, ${C.sage}, ${C.honey})`, transition: "width 0.4s" }} /></div>
                {cats.map(cat => (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <Lbl style={{ marginBottom: 4 }}>{cat}</Lbl>
                    {groceryList.filter(g => g.category === cat).map(g => {
                      const itemKey = g.id ? String(g.id) : `${g.category}-${g.item}-${g._tempKey || 0}`;
                      const isEditingItem = editingGroceryId === itemKey;
                      return (
                        <div key={itemKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}50` }}>
                          <div onClick={() => !isEditingItem && toggleGroceryItem(g)} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${g.checked ? C.sage : C.border}`, background: g.checked ? C.sageLight : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.sage, cursor: "pointer" }}>{g.checked && "✓"}</div>
                          {isEditingItem
                            ? (<input autoFocus defaultValue={g.item} onBlur={e => saveGroceryItemEdit(g, e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveGroceryItemEdit(g, e.target.value); if (e.key === "Escape") setEditingGroceryId(null); }} style={{ flex: 1, padding: "3px 8px", background: "#fff", border: `1.5px solid ${C.sage}`, borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.text }} />)
                            : (<span onClick={() => toggleGroceryItem(g)} style={{ flex: 1, fontSize: 13, textDecoration: g.checked ? "line-through" : "none", color: g.checked ? C.dim : C.text, cursor: "pointer" }}>{g.item}</span>)}
                          {!isEditingItem && <button onClick={e => { e.stopPropagation(); setEditingGroceryId(itemKey); }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 11, padding: "2px 4px", flexShrink: 0, fontFamily: "inherit" }}>✎</button>}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input placeholder="Add custom item..." value={groceryNewItem} onChange={e => setGroceryNewItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCustomGroceryItem(); }} style={{ flex: 1, padding: "7px 10px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.text }} />
                    <button onClick={addCustomGroceryItem} style={{ padding: "7px 14px", borderRadius: 8, background: C.sage, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>+ Add</button>
                  </div>
                  {grocerySaved
                    ? (<div className="pop" style={{ textAlign: "center", padding: "8px", background: C.sageLight, borderRadius: 10, color: C.sage, fontWeight: 700, fontSize: 12 }}>✓ Grocery run logged to today's calendar!</div>)
                    : (<Btn full color={C.sage} onClick={saveGroceryRun}>Save Grocery Run 🛒</Btn>)}
                </div>
              </Card>
            );
          })()}

          <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginBottom: 6 }}>Showing Week {mealWeek} of {now.toLocaleDateString("en-US", { month: "long" })} · auto-detected from today's date</div><div style={{ display: "flex", gap: 6 }}>{[1,2,3,4].map(w => <Chip key={w} active={mealWeek === w} onClick={() => setMealWeek(w)} color={C.terra}>Week {w}</Chip>)}</div></div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>{Object.entries(TAGS).map(([key, val]) => (<Chip key={key} active={tagFilter === key} onClick={() => setTagFilter(tagFilter === key ? null : key)} color={val.color}>{val.letter} {key === "protein" ? "Protein" : key === "omega" ? "Omega-3" : key === "fiber" ? "Fiber" : "Probiotic"}</Chip>))}</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>{Object.keys(MEALS_BY_WEEK[1]).map(day => (<button key={day} onClick={() => setMealDay(day)} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: mealDay === day ? C.terra : C.cream, color: mealDay === day ? "#fff" : C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{day.slice(0, 3)}</button>))}</div>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>tap any meal to edit · budget-friendly <button onClick={() => { setMealEdits({}); if (profileId) sb.del("meal_edits", `profile_id=eq.${profileId}`); }} style={{ marginLeft: 8, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>reset</button></div>
          {["morning","midday","evening","snack"].map(slot => {
            const meal = getMeal(mealDay, slot);
            if (!meal) return null;
            if (tagFilter && !meal.tags?.includes(tagFilter)) return null;
            const ac = slot === "morning" ? C.honey : slot === "midday" ? C.sage : slot === "evening" ? C.terra : C.sky;
            const mealKey = `${mealWeek}-${mealDay}-${slot}`;
            const isEdit = editingMeal === mealKey;
            return (<Card key={slot} style={{ marginBottom: 10, borderLeft: `4px solid ${ac}`, borderRadius: "4px 16px 16px 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: ac }}>{slot}</span>{meal.time && <span style={{ fontSize: 10, color: C.dim, background: C.cream, padding: "2px 8px", borderRadius: 99 }}>{meal.time}</span>}</div>
              {isEdit ? <input autoFocus defaultValue={meal.name} onBlur={e => saveMealEdit(mealKey, e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveMealEdit(mealKey, e.target.value); }} style={{ width: "100%", padding: "6px 10px", border: `2px solid ${ac}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.cream, color: C.text, boxSizing: "border-box" }} /> : <div onClick={() => setEditingMeal(mealKey)} style={{ fontSize: 14, lineHeight: 1.5, cursor: "pointer" }}>{meal.name}</div>}
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>{meal.tags?.map(t => <TagBadge key={t} tag={t} />)}</div>
            </Card>);
          })}
        </div>)}

        {/* LEARN */}
        {view === "learn" && (<div className="anim">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600 }}>Interactive Learning</div>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 12, fontStyle: "italic" }}>fresh ideas every week — pick a child or age range</div>

          {/* Progress Dashboard */}
          {(() => {
            const prog = getSubjectProgress(learnAge);
            const streak = getStreak(learnAge);
            const selectedChild = children.find(c => c.name.trim() && c.age && getChildAgeRange(c.age) === learnAge);
            return (
              <Card style={{ marginBottom: 14, background: C.sageLight, border: `1.5px solid ${C.sage}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Lora', serif", fontSize: 16, fontWeight: 600, color: C.sage }}>Progress Dashboard</div>
                    {selectedChild ? (<div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{selectedChild.name} · Ages {learnAge}</div>) : (<div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Ages {learnAge}</div>)}
                  </div>
                  <div style={{ textAlign: "center", background: C.honey + "30", borderRadius: 10, padding: "4px 12px", border: `1px solid ${C.honey}50` }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.honey, fontFamily: "'Lora', serif" }}>{streak}</div>
                    <div style={{ fontSize: 9, color: C.sub, textTransform: "uppercase", letterSpacing: 0.8 }}>activities done</div>
                  </div>
                </div>
                {SUBJECTS.map(sub => {
                  const m = SUBJECT_META[sub];
                  const { done, total } = prog[sub];
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  return (
                    <div key={sub} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.icon} {m.label}</span>
                        <span style={{ fontSize: 11, color: C.dim }}>{done}/{total}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 99, background: "#fff" }}><div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: m.color, transition: "width 0.4s" }} /></div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}
          {children.some(c => c.name.trim() && c.age) ? (<Card style={{ marginBottom: 14 }}><Lbl>Pick a child</Lbl><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>{children.filter(c => c.name.trim() && c.age).map(child => { const range = getChildAgeRange(child.age); const isA = learnAge === range; return (<button key={child.id} onClick={() => setLearnAge(range)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, border: isA ? `2px solid ${C.terra}` : `1.5px solid ${C.border}`, background: isA ? C.terraLight : "transparent", cursor: "pointer", fontFamily: "inherit" }}><div style={{ width: 30, height: 30, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: isA ? C.terra : C.cream, color: isA ? "#fff" : C.sub, fontSize: 13, fontWeight: 800 }}>{child.name[0].toUpperCase()}</div><div style={{ textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{child.name}</div><div style={{ fontSize: 10, color: C.dim }}>Age {child.age} · {range} range</div></div></button>); })}</div></Card>) : (<Card style={{ marginBottom: 14, background: C.honeyLight, border: `1px solid ${C.honey}30` }}><div style={{ fontSize: 13, color: C.honey }}>Add children on the Home tab for personalized ideas!</div><div style={{ marginTop: 10 }}><Lbl>Or pick an age range</Lbl><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{AGE_RANGES.map(r => <Chip key={r} active={learnAge === r} onClick={() => setLearnAge(r)} color={C.terra}>{r} yrs</Chip>)}</div></div></Card>)}
          {children.some(c => c.name.trim() && c.age) && <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>{AGE_RANGES.map(r => <Chip key={r} active={learnAge === r} onClick={() => setLearnAge(r)} color={C.terra}>{r} yrs</Chip>)}</div>}
          <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: C.sub, fontStyle: "italic", marginBottom: 6 }}>Week {learnWeek} of {now.toLocaleDateString("en-US", { month: "long" })}</div><div style={{ display: "flex", gap: 6 }}>{[1,2,3,4].map(w => <Chip key={w} active={learnWeek === w} onClick={() => setLearnWeek(w)} color={C.sage}>Week {w}</Chip>)}</div></div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>{SUBJECTS.map(s => { const m = SUBJECT_META[s]; return (<button key={s} onClick={() => setLearnSubject(s)} style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: learnSubject === s ? m.color : C.cream, color: learnSubject === s ? "#fff" : C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}><span>{m.icon}</span> {m.label}</button>); })}</div>
          {/* AI generate row */}
          {(() => { const actKey = `${learnAge}-${learnSubject}-${learnWeek}`; return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <button
                onClick={generateActivities}
                disabled={aiActivitiesLoading}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: `1.5px solid ${SUBJECT_META[learnSubject].color}`, background: aiActivitiesLoading ? SUBJECT_META[learnSubject].color + "18" : "transparent", color: SUBJECT_META[learnSubject].color, fontSize: 12, fontWeight: 700, cursor: aiActivitiesLoading ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.2s", flexShrink: 0 }}
              >
                {aiActivitiesLoading
                  ? <><span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${SUBJECT_META[learnSubject].color}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> Generating...</>
                  : "✦ Fresh Activities"}
              </button>
              {aiActivitiesSource[actKey] === "ai"
                ? <span style={{ fontSize: 10, color: C.sky, background: C.skyLight, padding: "3px 9px", borderRadius: 99, fontWeight: 700, border: `1px solid ${C.sky}40` }}>✦ AI-generated</span>
                : <span style={{ fontSize: 10, color: C.dim, background: C.cream, padding: "3px 9px", borderRadius: 99 }}>Default activities</span>}
            </div>
          ); })()}
          {aiActivitiesError && <div style={{ marginBottom: 10, padding: "9px 12px", background: C.honeyLight, border: `1px solid ${C.honey}50`, borderRadius: 10, fontSize: 12, color: C.sub, lineHeight: 1.5 }}>⚠ {aiActivitiesError}</div>}
          {(generatedActivities[`${learnAge}-${learnSubject}-${learnWeek}`] || LEARN_WEEKS[learnAge]?.[learnSubject]?.[learnWeek - 1] || []).map((activity, i) => {
            const isAI = !!generatedActivities[`${learnAge}-${learnSubject}-${learnWeek}`];
            const actKey = `${learnAge}-${learnSubject}-${learnWeek}-${i}`;
            const isDone = completedActivities[actKey];
            const calSt = addedToCalendar[actKey];
            return (<Card key={actKey} style={{ marginBottom: 10, opacity: isDone ? 0.6 : 1, transition: "opacity 0.2s", borderLeft: isAI ? `3px solid ${C.sky}` : undefined, borderRadius: isAI ? "4px 16px 16px 4px" : undefined }}>
              <div style={{ marginBottom: 8 }}>
                {isAI && <span style={{ fontSize: 9, color: C.sky, background: C.skyLight, padding: "2px 7px", borderRadius: 99, fontWeight: 700, marginBottom: 6, display: "inline-block" }}>✦ AI</span>}
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>{isDone && <span style={{ color: C.sage }}>✓</span>}{activity.title}</div><div style={{ fontSize: 13, lineHeight: 1.6, color: C.sub }}>{activity.desc}</div></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <span style={{ fontSize: 11, background: C.cream, padding: "3px 10px", borderRadius: 99, color: C.sub }}>⏱ {activity.duration}</span>
                <span style={{ fontSize: 11, background: C.cream, padding: "3px 10px", borderRadius: 99, color: C.sub }}>📦 {activity.materials}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <Btn small outline color={isDone ? C.sage : C.sub} onClick={() => toggleActivity(actKey)}>{isDone ? "Undo" : "Done ✓"}</Btn>
                  {calSt === "added" ? (<span className="pop" style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 10, background: C.sageLight, color: C.sage, fontSize: 11, fontWeight: 700, border: `1.5px solid ${C.sage}` }}>Added ✓</span>)
                  : calSt === "already" ? (<span className="pop" style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 10, background: C.honeyLight, color: C.honey, fontSize: 11, fontWeight: 700, border: `1.5px solid ${C.honey}` }}>Already added</span>)
                  : (<Btn small outline color={C.sky} onClick={() => addActivityToCalendar(activity, actKey)}>+ Calendar</Btn>)}
                </div>
              </div>
            </Card>);
          })}
          {(LEARN_WEEKS[learnAge]?.[learnSubject]?.[learnWeek - 1] || []).length === 0 && customActivities.filter(a => a.age_range === learnAge && a.subject === learnSubject && a.week === learnWeek).length === 0 && <Card style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 13, color: C.dim, fontStyle: "italic" }}>No activities for this combo — try another week or subject!</div></Card>}

          {/* Custom activities for current filter */}
          {customActivities.filter(a => a.age_range === learnAge && a.subject === learnSubject && a.week === learnWeek).map(act => {
            const actKey = `custom-${act.id}`;
            const isDone = completedActivities[actKey];
            const calSt = addedToCalendar[actKey];
            return (
              <Card key={actKey} style={{ marginBottom: 10, opacity: isDone ? 0.6 : 1, transition: "opacity 0.2s", borderLeft: `3px solid ${C.honey}`, background: isDone ? C.honeyLight + "80" : C.honeyLight + "40" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isDone && <span style={{ color: C.sage }}>✓</span>}
                    <span style={{ fontSize: 10, background: C.honey + "30", color: C.honey, border: `1px solid ${C.honey}50`, borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>✦ Custom</span>
                  </div>
                  <button onClick={() => deleteCustomActivity(act)} style={{ background: "none", border: "none", cursor: "pointer", color: C.dim, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{act.title}</div>
                  {act.desc && <div style={{ fontSize: 13, lineHeight: 1.6, color: C.sub }}>{act.desc}</div>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 11, background: C.cream, padding: "3px 10px", borderRadius: 99, color: C.sub }}>⏱ {act.duration}</span>
                  <span style={{ fontSize: 11, background: C.cream, padding: "3px 10px", borderRadius: 99, color: C.sub }}>📦 {act.materials}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <Btn small outline color={isDone ? C.sage : C.sub} onClick={() => toggleActivity(actKey)}>{isDone ? "Undo" : "Done ✓"}</Btn>
                    {calSt === "added" ? (<span className="pop" style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 10, background: C.sageLight, color: C.sage, fontSize: 11, fontWeight: 700, border: `1.5px solid ${C.sage}` }}>Added ✓</span>)
                    : calSt === "already" ? (<span className="pop" style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 10, background: C.honeyLight, color: C.honey, fontSize: 11, fontWeight: 700, border: `1.5px solid ${C.honey}` }}>Already added</span>)
                    : (<Btn small outline color={C.sky} onClick={() => addActivityToCalendar(act, actKey)}>+ Calendar</Btn>)}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Add Your Own Activity */}
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setAddActivityOpen(p => !p)} style={{ width: "100%", background: addActivityOpen ? C.honeyLight : "transparent", border: `1.5px dashed ${C.honey}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", color: C.honey, fontWeight: 700, fontSize: 13, fontFamily: "'Nunito Sans', sans-serif" }}>
              <span>✦ Add Your Own Activity</span>
              <span style={{ fontSize: 16 }}>{addActivityOpen ? "−" : "+"}</span>
            </button>
            {addActivityOpen && (
              <Card style={{ marginTop: 6, border: `1.5px solid ${C.honey}40`, background: C.honeyLight + "50" }}>
                <div style={{ marginBottom: 10 }}>
                  <Lbl>Activity Title *</Lbl>
                  <input value={activityForm.title} onChange={e => setActivityForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Nature Scavenger Hunt" style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Nunito Sans', sans-serif", background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Lbl>Description</Lbl>
                  <textarea value={activityForm.desc} onChange={e => setActivityForm(p => ({ ...p, desc: e.target.value }))} placeholder="What will you do? Any tips?" rows={3} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Nunito Sans', sans-serif", background: C.surface, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <Lbl>Subject</Lbl>
                    <select value={activityForm.subject} onChange={e => setActivityForm(p => ({ ...p, subject: e.target.value }))} style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "'Nunito Sans', sans-serif", background: C.surface, color: C.text, outline: "none" }}>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl>Duration</Lbl>
                    <input value={activityForm.duration} onChange={e => setActivityForm(p => ({ ...p, duration: e.target.value }))} placeholder="20 min" style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "'Nunito Sans', sans-serif", background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Lbl>Materials</Lbl>
                  <input value={activityForm.materials} onChange={e => setActivityForm(p => ({ ...p, materials: e.target.value }))} placeholder="e.g. Paper, crayons" style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "'Nunito Sans', sans-serif", background: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Btn small outline color={C.sub} onClick={() => { setAddActivityOpen(false); setActivityForm({ title: "", desc: "", subject: "reading", duration: "20 min", materials: "None" }); }}>Cancel</Btn>
                  <Btn small color={C.honey} onClick={saveCustomActivity} disabled={!activityForm.title.trim()}>Save Activity</Btn>
                </div>
              </Card>
            )}
          </div>
        </div>)}

        {/* MONEY */}
        {view === "money" && (<div className="anim">
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600, marginBottom: 14 }}>Finances</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Card style={{ padding: 14 }}><Lbl>Income</Lbl><div style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ color: C.dim }}>$</span><input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} style={{ background: "transparent", border: "none", color: C.sage, fontSize: 26, fontWeight: 700, fontFamily: "'Lora', serif", outline: "none", width: "100%" }} /></div></Card>
            <Card style={{ padding: 14 }}><Lbl>Expenses</Lbl><div style={{ fontSize: 26, fontWeight: 700, color: C.terra, fontFamily: "'Lora', serif" }}>${totalSpend.toLocaleString()}</div></Card>
          </div>
          <Card style={{ marginBottom: 14, background: surplus >= 0 ? C.sageLight : C.terraLight }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontWeight: 700, color: surplus >= 0 ? C.sage : C.terra }}>{surplus >= 0 ? "Monthly surplus" : "Over budget"}</div><div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{surplus >= 0 ? "put this toward savings" : "adjust categories"}</div></div><div style={{ fontSize: 30, fontWeight: 700, color: surplus >= 0 ? C.sage : C.terra, fontFamily: "'Lora', serif" }}>{surplus >= 0 ? "+" : ""}${Math.abs(surplus)}</div></div></Card>
          <Card style={{ marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}><span style={{ color: C.sub }}>{income > 0 ? Math.round((totalSpend / income) * 100) : 0}% of income</span><span style={{ color: totalSpend <= income ? C.sage : C.terra, fontWeight: 700 }}>{totalSpend <= income ? "on track" : "over"}</span></div><div style={{ height: 10, borderRadius: 99, background: C.cream, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, income > 0 ? (totalSpend / income) * 100 : 0)}%`, borderRadius: 99, background: totalSpend <= income ? `linear-gradient(90deg, ${C.sage}, ${C.honey})` : C.terra, transition: "width 0.5s" }} /></div></Card>
          <Card style={{ marginBottom: 14 }}><Lbl>Budget Breakdown</Lbl>{BUDGET_ROWS.map(row => { const mx = Math.max(...Object.values(budget)); return (<div key={row.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: row.color }} /><div style={{ width: 72, fontSize: 12, color: C.sub }}>{row.name}</div><div style={{ flex: 1, height: 7, borderRadius: 99, background: C.cream }}><div style={{ height: "100%", width: mx > 0 ? `${(budget[row.name] / mx) * 100}%` : "0%", borderRadius: 99, background: row.color, transition: "width 0.3s" }} /></div><div style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ fontSize: 11, color: C.dim }}>$</span><input type="number" value={budget[row.name]} onChange={e => setBudget(p => ({ ...p, [row.name]: Number(e.target.value) }))} style={{ width: 52, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 6px", color: C.text, fontSize: 13, fontFamily: "inherit", textAlign: "right", outline: "none" }} /></div></div>); })}</Card>
          <Card style={{ marginBottom: 14 }}><Lbl>Log Expense</Lbl><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}><Field label="Child"><Sel value={expForm.child} onChange={e => setExpForm(f => ({ ...f, child: e.target.value }))}><option value="">Select</option>{childNames.map(n => <option key={n}>{n}</option>)}<option>All</option></Sel></Field><Field label="Category"><Sel value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}>{SPEND_CATS.map(c => <option key={c}>{c}</option>)}</Sel></Field></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}><Field label="Description"><Inp placeholder="e.g. Soccer signup" value={expForm.desc} onChange={e => setExpForm(f => ({ ...f, desc: e.target.value }))} /></Field><Field label="Amount"><Inp type="number" placeholder="0.00" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} /></Field></div><div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}><Btn color={C.terra} onClick={addExpense}>{editingExpenseId ? "Update Expense" : "Save Expense"}</Btn>{editingExpenseId && <Btn outline color={C.sub} onClick={() => { setEditingExpenseId(null); setExpForm(f => ({ ...f, desc: "", amount: "" })); }}>Cancel</Btn>}{editingExpenseId && <span style={{ fontSize: 11, color: C.honey, fontStyle: "italic" }}>Editing…</span>}</div></Card>
          {expenses.length > 0 && <Card style={{ marginBottom: 14 }}><Lbl>Expense History · {expenses.length}</Lbl>{expenses.map(e => (<div key={e.id} style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 0" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><div><div style={{ fontWeight: 600 }}>{e.desc}</div><div style={{ fontSize: 11, color: C.dim }}>{e.category}{e.child ? ` · ${e.child}` : ""}</div></div><div style={{ fontWeight: 700, color: C.terra }}>${e.amount.toFixed(2)}</div></div><div style={{ display: "flex", gap: 6 }}><button onClick={() => startEditExpense(e)} style={{ padding: "3px 10px", borderRadius: 8, border: `1.5px solid ${C.sky}`, background: "transparent", color: C.sky, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✎ Edit</button>{expAddedToCalendar[e.id] ? (<span className="pop" style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 8, background: C.sageLight, border: `1.5px solid ${C.sage}`, color: C.sage, fontSize: 11, fontWeight: 700 }}>✓ Added</span>) : (<button onClick={() => addExpenseToCalendar(e)} style={{ padding: "3px 10px", borderRadius: 8, border: `1.5px solid ${C.sage}`, background: "transparent", color: C.sage, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Calendar</button>)}<button onClick={() => deleteExpense(e.id)} style={{ padding: "3px 10px", borderRadius: 8, border: `1.5px solid ${C.terra}`, background: "transparent", color: C.terra, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>× Delete</button></div></div>))}</Card>}

          {/* Savings Goals */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600 }}>Savings Goals</div>
              <Btn small color={C.sky} onClick={() => setAddingGoal(!addingGoal)}>+ Goal</Btn>
            </div>
            {addingGoal && (<div style={{ background: C.cream, borderRadius: 12, padding: 12, marginBottom: 12, border: `1.5px solid ${C.sky}30` }} className="anim">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <Field label="Goal name"><Inp placeholder="Emergency fund" value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="Target $"><Inp type="number" placeholder="500" value={goalForm.target} onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))} /></Field>
                <Field label="Saved $"><Inp type="number" placeholder="0" value={goalForm.current} onChange={e => setGoalForm(f => ({ ...f, current: e.target.value }))} /></Field>
              </div>
              <div style={{ marginBottom: 10 }}><Field label="Icon"><div style={{ display: "flex", gap: 6 }}>{["🌱","🎂","📚","🏠","✈️","🎁","💊","🐾"].map(em => (<button key={em} onClick={() => setGoalForm(f => ({ ...f, emoji: em }))} style={{ padding: "4px 6px", borderRadius: 8, border: goalForm.emoji === em ? `2px solid ${C.sky}` : `1.5px solid ${C.border}`, background: goalForm.emoji === em ? C.skyLight : "transparent", fontSize: 18, cursor: "pointer" }}>{em}</button>))}</div></Field></div>
              <div style={{ display: "flex", gap: 8 }}><Btn color={C.sky} onClick={saveGoal}>Save goal</Btn><Btn outline color={C.sub} onClick={() => setAddingGoal(false)}>Cancel</Btn></div>
            </div>)}
            {savingsGoals.length === 0 && !addingGoal && <div style={{ textAlign: "center", padding: "12px 0", color: C.dim, fontSize: 13, fontStyle: "italic" }}>No goals yet — add an emergency fund, birthday savings, and more</div>}
            {savingsGoals.map(goal => {
              const pct = Math.min(100, goal.target > 0 ? (goal.current / goal.target) * 100 : 0);
              const isEditing = editingGoal === goal.id;
              return (<div key={goal.id} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 22 }}>{goal.emoji}</span><div><div style={{ fontWeight: 700, fontSize: 14 }}>{goal.name}</div><div style={{ fontSize: 11, color: C.dim }}>${goal.current.toFixed(0)} of ${goal.target.toFixed(0)}</div></div></div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? C.sage : C.sky }}>{Math.round(pct)}%</span>
                    <button onClick={() => setEditingGoal(isEditing ? null : goal.id)} style={{ background: "none", border: "none", color: C.sky, cursor: "pointer", fontSize: 12, padding: "2px 4px" }}>✎</button>
                    <button onClick={() => deleteGoal(goal.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>×</button>
                  </div>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: C.cream, marginBottom: 4 }}><div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 100 ? `linear-gradient(90deg, ${C.sage}, ${C.honey})` : `linear-gradient(90deg, ${C.sky}, ${C.sage})`, transition: "width 0.5s" }} /></div>
                {pct >= 100 && <div style={{ fontSize: 11, color: C.sage, fontWeight: 700 }}>🎉 Goal reached!</div>}
                {isEditing && (<div style={{ marginTop: 8, display: "flex", gap: 8 }} className="anim">
                  <Inp type="number" placeholder="Current saved $" defaultValue={goal.current} onBlur={e => { updateGoalAmount(goal.id, parseFloat(e.target.value) || 0); setEditingGoal(null); }} style={{ flex: 1 }} autoFocus />
                </div>)}
              </div>);
            })}
          </Card>
        </div>)}

        {/* CALENDAR */}
        {view === "calendar" && (<div className="anim">
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600, marginBottom: 14 }}>Calendar</div>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}><button onClick={() => { if (cM === 0) { setCM(11); setCY(cY - 1); } else setCM(cM - 1); }} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", color: C.text, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>←</button><div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16, fontFamily: "'Lora', serif" }}>{monthLabel}</div><button onClick={() => { if (cM === 11) { setCM(0); setCY(cY + 1); } else setCM(cM + 1); }} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", color: C.text, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>→</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {WEEK_DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: C.dim, padding: "4px 0" }}>{d}</div>)}
              {Array.from({ length: first }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: numDays }, (_, i) => { const d = i + 1; const k = dk(cY, cM, d); const hN = (calNotes[k] || []).length > 0; const hE = (calEvents[k] || []).filter(e => e.type === "learning").length > 0; const hJ = (calEvents[k] || []).filter(e => e.type === "journal").length > 0; const hSC = (calEvents[k] || []).filter(e => e.type === "selfcare").length > 0; const hGr = (calEvents[k] || []).filter(e => e.type === "grocery").length > 0; const hEx = (calEvents[k] || []).filter(e => e.type === "expense").length > 0; const isT = now.getFullYear() === cY && now.getMonth() === cM && now.getDate() === d; const isSel = selDay === d; return (<button key={d} onClick={() => setSelDay(selDay === d ? null : d)} style={{ aspectRatio: 1, borderRadius: 10, position: "relative", border: isT ? `2px solid ${C.terra}` : isSel ? `2px solid ${C.sage}` : `1px solid ${C.border}50`, background: isSel ? C.sageLight : isT ? C.terraLight : "#fff", color: isT ? C.terra : C.text, fontWeight: isT ? 800 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{d}{(hN || hE || hJ || hSC || hGr || hEx) && <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>{hN && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.terra }} />}{hJ && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.sage }} />}{hE && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.sky }} />}{hSC && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.honey }} />}{hGr && <div style={{ width: 4, height: 4, borderRadius: 99, background: "#D4857C" }} />}{hEx && <div style={{ width: 4, height: 4, borderRadius: 99, background: C.sub }} />}</div>}</button>); })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 10, color: C.dim, flexWrap: "wrap" }}><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.terra }} /> Notes</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.sage }} /> Journal</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.sky }} /> Learning</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.honey }} /> Self-care</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: "#D4857C" }} /> Grocery</span><span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.sub }} /> Expenses</span></div>
          </Card>
          {selDay && (<div className="anim"><Card style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, marginBottom: 2 }}>{new Date(cY, cM, selDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{cY}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><input placeholder="Add a note or to-do..." value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNoteToDay(); }} style={{ flex: 1, padding: "9px 12px", background: C.cream, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.text }} /><Btn color={C.terra} onClick={addNoteToDay}>Add</Btn></div>
            {(calNotes[dk(cY, cM, selDay)] || []).length > 0 && <div style={{ marginBottom: 14 }}><Lbl>Notes & To-Dos</Lbl>{calNotes[dk(cY, cM, selDay)].map(note => (<div key={note.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}><button onClick={() => toggleNoteStatus(dk(cY, cM, selDay), note.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `2px solid ${note.done ? C.sage : C.border}`, background: note.done ? C.sageLight : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.sage }}>{note.done && "✓"}</button><span style={{ flex: 1, fontSize: 13, textDecoration: note.done ? "line-through" : "none", color: note.done ? C.dim : C.text }}>{note.text}</span><button onClick={() => deleteNote(dk(cY, cM, selDay), note.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4 }}>×</button></div>))}</div>}
            {(calEvents[dk(cY, cM, selDay)] || []).filter(e => e.type === "journal").length > 0 && <div style={{ marginBottom: 14 }}><Lbl>Journal Entries</Lbl>{calEvents[dk(cY, cM, selDay)].filter(e => e.type === "journal").map((evt) => (<div key={evt.id} style={{ background: C.sageLight, borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid ${C.sage}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.sage }}>{evt.title}</div><div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{evt.desc}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{evt.materials}</div></div><button onClick={() => deleteCalEvent(dk(cY, cM, selDay), evt.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 }}>×</button></div>))}</div>}
            {(calEvents[dk(cY, cM, selDay)] || []).filter(e => e.type === "learning").length > 0 && <div><Lbl>Scheduled Learning</Lbl>{calEvents[dk(cY, cM, selDay)].filter(e => e.type === "learning").map((evt) => (<div key={evt.id} style={{ background: C.skyLight, borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid ${C.sky}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.sky }}>{evt.title}</div><div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{evt.desc?.slice(0, 80)}...</div><div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>⏱ {evt.duration} · 📦 {evt.materials}</div></div><button onClick={() => deleteCalEvent(dk(cY, cM, selDay), evt.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 }}>×</button></div>))}</div>}
            {(calEvents[dk(cY, cM, selDay)] || []).filter(e => e.type === "selfcare").length > 0 && <div style={{ marginTop: 14 }}><Lbl>Self-Care Check-ins</Lbl>{calEvents[dk(cY, cM, selDay)].filter(e => e.type === "selfcare").map((evt) => (<div key={evt.id} style={{ background: C.honeyLight, borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid ${C.honey}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.honey }}>{evt.title}</div>{evt.desc && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{evt.desc}</div>}</div><button onClick={() => deleteCalEvent(dk(cY, cM, selDay), evt.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 }}>×</button></div>))}</div>}
            {(calEvents[dk(cY, cM, selDay)] || []).filter(e => e.type === "grocery").length > 0 && <div style={{ marginTop: 14 }}><Lbl>Grocery Runs</Lbl>{calEvents[dk(cY, cM, selDay)].filter(e => e.type === "grocery").map((evt) => {
              const items = evt.desc ? evt.desc.split(", ").map(s => s.trim()).filter(Boolean) : [];
              const isExpanded = expandedGroceryEvents[evt.id];
              const PREVIEW = 3;
              return (
                <div key={evt.id} style={{ background: "#FAE8E5", borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid #D4857C` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#B06058" }}>{evt.title}</div>
                    <button onClick={() => deleteCalEvent(dk(cY, cM, selDay), evt.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 }}>×</button>
                  </div>
                  {items.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div>
                        {(isExpanded ? items : items.slice(0, PREVIEW)).map((item, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: "#B06058", padding: "2px 0", display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ color: "#D4857C", fontSize: 10 }}>✦</span>{item}
                          </div>
                        ))}
                      </div>
                      {items.length > PREVIEW && (
                        <button onClick={() => setExpandedGroceryEvents(p => ({ ...p, [evt.id]: !p[evt.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#B06058", fontSize: 11, fontWeight: 700, padding: "4px 0 0", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3 }}>
                          {isExpanded ? `▲ Show less` : `▼ Show all ${items.length} items`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}</div>}
            {(calEvents[dk(cY, cM, selDay)] || []).filter(e => e.type === "expense").length > 0 && <div style={{ marginTop: 14 }}><Lbl>Expenses</Lbl>{calEvents[dk(cY, cM, selDay)].filter(e => e.type === "expense").map((evt) => (<div key={evt.id} style={{ background: C.cream, borderRadius: 10, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid ${C.sub}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{evt.title}</div>{evt.desc && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{evt.desc}</div>}</div><button onClick={() => deleteCalEvent(dk(cY, cM, selDay), evt.id)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14, padding: 4, flexShrink: 0 }}>×</button></div>))}</div>}
            {(calNotes[dk(cY, cM, selDay)] || []).length === 0 && (calEvents[dk(cY, cM, selDay)] || []).length === 0 && <div style={{ textAlign: "center", padding: "12px 0", color: C.dim, fontSize: 13, fontStyle: "italic" }}>Nothing here yet — add a note, log a journal entry, or schedule learning</div>}
          </Card></div>)}
        </div>)}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(253,250,246,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "6px 0 14px", zIndex: 100 }}>
        {NAV.map(n => (<button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 10px", color: view === n.id ? C.terra : C.dim, fontFamily: "inherit", position: "relative" }}>{view === n.id && <div style={{ position: "absolute", top: -6, width: 20, height: 2.5, borderRadius: 99, background: C.terra }} />}<span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span><span style={{ fontSize: 10, fontWeight: view === n.id ? 700 : 500 }}>{n.label}</span></button>))}
      </div>
    </div>
  );
}
