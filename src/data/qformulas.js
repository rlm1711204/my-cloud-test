// Built-in Formula Book for Maths & Reasoning. Same plain-text format as the copy-paste prompts:
//   ## Subject › Topic          (names must match src/lib/quant-taxonomy.js)
//   FORMULA: name               F: the formula or rule (several lines allowed)
//   T: trick / how to use it    E: a small worked example
//   FIG: <svg …>…</svg>         a labelled figure on one line (optional; see CUSTOMISE.md)
// Keep every line correct — the tests check the format on every build.
export default `
## Quant › Number System
FORMULA: Divisibility rules
F: 2 → last digit even · 3 → digit sum divisible by 3 · 4 → last 2 digits divisible by 4 · 5 → ends in 0 or 5
F: 8 → last 3 digits divisible by 8 · 9 → digit sum divisible by 9 · 11 → (sum of odd-place digits − sum of even-place digits) is 0 or a multiple of 11
T: 3 and 9 → add the digits; 4 and 8 → look at the last 2 and 3 digits; 6 = 2 and 3 together; 12 = 3 and 4 together.
E: 7392 → last 3 digits 392 = 8 × 49, so 7392 is divisible by 8.

FORMULA: Number of factors
F: If N = aᵖ × b^q × cʳ (prime factors), number of factors = (p + 1)(q + 1)(r + 1)
T: Add 1 to every power and multiply.
E: 72 = 2³ × 3² → (3 + 1)(2 + 1) = 12 factors.

FORMULA: Sums of natural numbers
F: 1 + 2 + … + n = n(n + 1)/2
F: 1² + 2² + … + n² = n(n + 1)(2n + 1)/6
F: 1³ + 2³ + … + n³ = [n(n + 1)/2]²
T: Sum of cubes = (sum of numbers)².
E: 1 + 2 + … + 20 = 20 × 21/2 = 210.

FORMULA: Unit digit of a power (cyclicity)
F: Unit digits repeat every 4 powers: 2 → 2, 4, 8, 6 · 3 → 3, 9, 7, 1 · 7 → 7, 9, 3, 1 · 8 → 8, 4, 2, 6
F: 0, 1, 5, 6 never change · 4 → 4, 6 (odd/even power) · 9 → 9, 1 (odd/even power)
T: Divide the power by 4 and use the remainder (remainder 0 → take the 4th value).
E: Unit digit of 7³⁵: 35 ÷ 4 leaves 3 → 3rd value of 7, 9, 3, 1 = 3.

## Quant › HCF & LCM
FORMULA: HCF × LCM
F: HCF × LCM = product of the two numbers
T: Works for TWO numbers only.
E: 12 and 18: HCF 6 × LCM 36 = 216 = 12 × 18.

FORMULA: HCF and LCM of fractions
F: HCF = HCF of numerators / LCM of denominators
F: LCM = LCM of numerators / HCF of denominators
T: "HCF: H over L, LCM: L over H".
E: 2/3 and 4/9: HCF = 2/9, LCM = 4/3.

## Quant › Simplification & Approximation
FORMULA: Square of a number ending in 5
F: (n5)² = n × (n + 1), then write 25
T: Multiply the first part by the next number, add 25 at the end.
E: 65² → 6 × 7 = 42 → 4225.

FORMULA: Multiply a two-digit number by 11
F: ab × 11 = a (a + b) b, carrying 1 if a + b ≥ 10
T: Split the digits and put their sum in the middle.
E: 52 × 11 = 572; 87 × 11 = 8 (15) 7 → 957.

FORMULA: Squares and cubes to remember
F: Squares 11² = 121 … 25² = 625 (13² = 169, 17² = 289, 19² = 361, 23² = 529)
F: Cubes 1³ … 15³ (7³ = 343, 9³ = 729, 11³ = 1331, 12³ = 1728, 13³ = 2197)
T: Learn squares to 30 and cubes to 15 — they save the most time in simplification.
E: √529 = 23 because it ends in 9 (3 or 7) and lies between 20² = 400 and 25² = 625.

## Quant › Algebra
FORMULA: Algebraic identities
F: (a + b)² = a² + 2ab + b² · (a − b)² = a² − 2ab + b² · a² − b² = (a + b)(a − b)
F: (a + b)³ = a³ + b³ + 3ab(a + b) · a³ + b³ = (a + b)(a² − ab + b²) · a³ − b³ = (a − b)(a² + ab + b²)
T: Most simplification questions are one of these in disguise.
E: 101² − 99² = (101 + 99)(101 − 99) = 400.

FORMULA: a³ + b³ + c³ − 3abc
F: a³ + b³ + c³ − 3abc = (a + b + c)(a² + b² + c² − ab − bc − ca)
F: If a + b + c = 0, then a³ + b³ + c³ = 3abc
T: Check first whether the three numbers add up to 0.
E: a = −2, b = 5, c = −3 (sum 0): −8 + 125 − 27 = 90 = 3 × (−2) × 5 × (−3).

FORMULA: x + 1/x
F: If x + 1/x = k, then x² + 1/x² = k² − 2 and x³ + 1/x³ = k³ − 3k
T: Square for the 2nd power, cube for the 3rd.
E: x + 1/x = 3 → x² + 1/x² = 7, x³ + 1/x³ = 27 − 9 = 18.

## Quant › Percentage
FORMULA: Percentage change and successive change
F: % change = (change / original) × 100
F: Two successive changes x% and y%: net = x + y + xy/100 (use − for a decrease)
T: Works for price × quantity, length × breadth, rate × time — any product.
E: +20% then −10% → 20 − 10 − 200/100 = +8%.

FORMULA: Fractions as percentages
F: 1/2 = 50% · 1/3 = 33.33% · 1/4 = 25% · 1/5 = 20% · 1/6 = 16.67% · 1/7 = 14.28%
F: 1/8 = 12.5% · 1/9 = 11.11% · 1/11 = 9.09% · 1/12 = 8.33% · 1/16 = 6.25% · 1/20 = 5%
T: Turn every % into a fraction first: 37.5% = 3/8, 62.5% = 5/8, 87.5% = 7/8.
E: 37.5% of 640 = 3/8 × 640 = 240.

FORMULA: More than / less than
F: If A is x% more than B, B is less than A by x/(100 + x) × 100 %
F: If A is x% less than B, B is more than A by x/(100 − x) × 100 %
T: Same rule for "price up by x% → cut consumption by x/(100 + x) to keep spending the same".
E: A is 25% more than B → B is 25/125 = 20% less than A.

FORMULA: Population growth and depreciation
F: After n years: P × (1 + r/100)ⁿ (growth) or P × (1 − r/100)ⁿ (depreciation)
T: Same as compound interest.
E: 10,000 growing 10% a year for 2 years → 10,000 × 1.21 = 12,100.

## Quant › Profit & Loss
FORMULA: Profit and loss percent
F: Profit % = Profit / CP × 100 · Loss % = Loss / CP × 100
F: SP = CP × (100 + profit%)/100 · SP = CP × (100 − loss%)/100
T: Profit and loss are always on Cost Price; discount is always on Marked Price.
E: CP ₹400, profit 25% → SP = 400 × 125/100 = ₹500.

FORMULA: Discount and successive discounts
F: SP = MP × (100 − d)/100
F: Successive discounts d₁% and d₂%: single discount = d₁ + d₂ − d₁d₂/100
T: Successive-change rule with minus signs.
E: 20% and 10% → 30 − 2 = 28%.

FORMULA: Same SP, x% profit on one and x% loss on the other
F: Always a LOSS of x²/100 %
T: Equal SP, equal % → always loss of (x/10)².
E: Two items sold at ₹990, one at 10% profit and one at 10% loss → loss of 1%.

FORMULA: Dishonest dealer (false weight)
F: Gain % = (true weight − false weight)/false weight × 100
T: Divide the error by what he actually gives.
E: Gives 900 g for 1 kg → 100/900 × 100 = 11.11% gain.

FORMULA: Marked price for a profit after discount
F: MP/CP = (100 + profit%)/(100 − discount%)
T: Ratio of MP to CP from both percentages.
E: Profit 20% after a 20% discount → MP/CP = 120/80 = 3/2, so mark 50% above CP.

## Quant › Simple & Compound Interest
FORMULA: Simple interest
F: SI = P × R × T / 100 · Amount = P + SI
T: SI is the same every year.
E: ₹5,000 at 8% for 3 years → SI = 5000 × 8 × 3/100 = ₹1,200.

FORMULA: Compound interest
F: A = P(1 + R/100)ᵀ · CI = A − P
F: Half-yearly: rate R/2, time 2T · Quarterly: rate R/4, time 4T
T: Effective rate for 2 years: 10% → 21%, 20% → 44%, 5% → 10.25% (x + x + x²/100).
E: ₹10,000 at 10% for 2 years → A = 10,000 × 1.21 = ₹12,100, CI = ₹2,100.

FORMULA: Difference between CI and SI
F: 2 years: CI − SI = P(R/100)²
F: 3 years: CI − SI = P(R/100)²(3 + R/100)
T: For 2 years it is just "interest on interest" of one year.
E: P = ₹10,000, R = 10%: 2-year difference = 10,000 × 0.01 = ₹100.

## Quant › Ratio & Proportion
FORMULA: Proportionals
F: Mean proportional of a and b = √(ab)
F: Third proportional to a, b = b²/a · Fourth proportional to a, b, c = bc/a
T: a : b = b : x gives the third proportional x = b²/a.
E: Mean proportional of 4 and 9 = √36 = 6.

FORMULA: Combining ratios
F: If a : b and b : c are given, make b the same in both, then write a : b : c
T: Multiply each ratio so the common term matches (use the LCM of the two b values).
E: a : b = 2 : 3, b : c = 4 : 5 → 8 : 12 : 15.

## Quant › Partnership
FORMULA: Profit sharing
F: Profit ratio = (capital × time) ratio
T: Money × months for each partner, then share in that ratio.
E: A ₹5,000 for 12 months, B ₹6,000 for 10 months → 60,000 : 60,000 = 1 : 1.

## Quant › Averages
FORMULA: Average basics
F: Average = sum / number of items · Average of first n natural numbers = (n + 1)/2
F: When one value joins n values and the average rises by d: new value = old average + (n + 1) × d
T: Think in terms of "excess over the average".
E: Average of 10 numbers is 20; an 11th raises it to 21 → 11th = 20 + 11 × 1 = 31.

## Quant › Ages
FORMULA: Ages
F: The difference between two people's ages never changes
F: If ages are in the ratio a : b and after t years in c : d, solve a·k + t : b·k + t = c : d
T: Put the present ages as ak and bk; use the unchanging difference to check options fast.
E: Ratio 3 : 5, after 10 years 5 : 7 → (3k + 10)/(5k + 10) = 5/7 → 21k + 70 = 25k + 50 → k = 5, ages 15 and 25.

## Quant › Mixtures & Alligation
FORMULA: Rule of alligation
F: Cheaper quantity : Dearer quantity = (d − m) : (m − c)
F: c = cheaper price, d = dearer price, m = mean (mixture) price
T: Cross-subtract with the mean price in the middle.
E: Rice at ₹20 and ₹30 mixed to sell at ₹24 → (30 − 24) : (24 − 20) = 3 : 2.

FORMULA: Repeated replacement
F: Pure liquid left = initial × (1 − y/x)ⁿ, when y litres of x litres are taken out and replaced n times
T: Each round keeps the same fraction (1 − y/x).
E: 40 L milk, 4 L replaced by water twice → 40 × (9/10)² = 32.4 L milk.

## Quant › Time & Work
FORMULA: Two workers together
F: Together time = (a × b)/(a + b), when A takes a days and B takes b days
T: Product ÷ sum.
E: 10 and 15 days → 150/25 = 6 days.

FORMULA: Chain rule (men, days, hours, work)
F: M₁ × D₁ × H₁ / W₁ = M₂ × D₂ × H₂ / W₂
T: More men → fewer days; more work → more days.
E: 10 men finish in 12 days → 15 men take 10 × 12/15 = 8 days.

FORMULA: LCM (total work) method
F: Total work = LCM of the days; each person's efficiency = total work / own days
T: Avoids fractions — work in "units".
E: A 10 days, B 15 days → total 30 units, A 3/day, B 2/day → together 30/5 = 6 days.

## Quant › Pipes & Cisterns
FORMULA: Filling and leaking pipes
F: Fill pipe a hours, leak b hours (b > a): time to fill = (a × b)/(b − a)
T: Filling pipes add, emptying pipes subtract (LCM method works well).
E: Fills in 4 h, leak empties in 12 h → 48/8 = 6 hours.

## Quant › Time, Speed & Distance
FORMULA: Speed, distance and time
F: Speed = Distance / Time
F: km/h → m/s: × 5/18 · m/s → km/h: × 18/5
T: 18 km/h = 5 m/s, 36 = 10, 54 = 15, 72 = 20, 90 = 25.
E: 72 km/h = 72 × 5/18 = 20 m/s.

FORMULA: Average speed
F: Equal distances at x and y: average speed = 2xy/(x + y)
F: In general: average speed = total distance / total time
T: Never take the simple average of speeds.
E: 40 km/h and 60 km/h for equal distances → 4800/100 = 48 km/h.

FORMULA: Relative speed
F: Same direction: x − y · Opposite directions: x + y
F: Meeting time = distance between them / relative speed
T: Fix one object and move the other at the relative speed.
E: Two people 60 km apart walking towards each other at 4 and 6 km/h meet in 6 hours.

## Quant › Trains
FORMULA: Train crossing
F: Pole or person: time = train length / speed
F: Platform, bridge or another train: time = (sum of lengths) / relative speed
T: Convert km/h to m/s first.
E: 150 m train at 54 km/h (15 m/s) passes a pole in 10 s.

## Quant › Boats & Streams
FORMULA: Downstream and upstream
F: Downstream = b + s · Upstream = b − s
F: Boat speed b = (down + up)/2 · Stream speed s = (down − up)/2
T: Half the sum = boat, half the difference = stream.
E: Down 15 km/h, up 9 km/h → boat 12, stream 3 km/h.

## Quant › Mensuration
FORMULA: 2D shapes
F: Rectangle: area lb, perimeter 2(l + b) · Square: area a², diagonal a√2
F: Circle: area πr², circumference 2πr · Sector: (θ/360) × πr²
F: Triangle: ½ × base × height · Heron: √(s(s − a)(s − b)(s − c)), s = (a + b + c)/2 · Equilateral: (√3/4)a²
F: Trapezium: ½(a + b) × h · Rhombus: ½ × d₁ × d₂
T: π = 22/7 → choose radii in multiples of 7.
E: Circle of radius 7 cm → area 22/7 × 49 = 154 cm².

FORMULA: 3D shapes
F: Cube: volume a³, total surface 6a², diagonal a√3 · Cuboid: lbh, 2(lb + bh + hl), diagonal √(l² + b² + h²)
F: Cylinder: πr²h, curved surface 2πrh, total 2πr(r + h)
F: Cone: ⅓πr²h, curved surface πrl, slant l = √(r² + h²)
F: Sphere: (4/3)πr³, surface 4πr² · Hemisphere: (2/3)πr³, curved 2πr², total 3πr²
T: A cone holds ⅓ of the cylinder with the same base and height.
E: Cylinder r = 7 cm, h = 10 cm → 22/7 × 49 × 10 = 1540 cm³.

FORMULA: Area change when sides change
F: Each side changes by x% → area changes by 2x + x²/100 %
T: Successive-change rule with x and x.
E: Each side +10% → area +21%.

## Quant › Quadratic Equations
FORMULA: Roots of a quadratic
F: ax² + bx + c = 0: x = [−b ± √(b² − 4ac)] / 2a · sum of roots = −b/a · product = c/a
T: Split the middle term: find two numbers with product a × c and sum b; the roots are their negatives ÷ a.
E: x² − 7x + 12 = 0 → −3 × −4 = 12, −3 + −4 = −7 → roots 3 and 4.

FORMULA: Comparing x and y (bank exams)
F: Find both roots of each equation, then compare every x with every y
F: All x > all y → x > y · all x ≥ all y → x ≥ y · mixed → relationship cannot be established
T: Signs of the roots are the opposite of the signs in the middle term (for + c).
E: x² − 5x + 6 = 0 (2, 3) and y² + 5y + 6 = 0 (−2, −3) → x > y.

## Quant › Geometry
FORMULA: Triangle centres
F: Centroid divides each median in the ratio 2 : 1
F: Angle at incentre = 90° + A/2 · angle at circumcentre = 2A · angle at orthocentre = 180° − A
T: "In = 90 + half, Circum = double, Ortho = 180 minus".
E: A = 60° → incentre angle BIC = 120°.

FORMULA: Polygon angles
F: Sum of interior angles = (n − 2) × 180° · each exterior angle of a regular polygon = 360°/n
T: Exterior angles always add up to 360°.
E: Hexagon: interior sum 720°, each exterior angle 60°.

FORMULA: Pythagorean triplets
F: (3, 4, 5) · (5, 12, 13) · (8, 15, 17) · (7, 24, 25) · (9, 40, 41) · (20, 21, 29)
T: Multiples work too: (6, 8, 10), (9, 12, 15).
E: Sides 9 and 12 → hypotenuse 15.

FORMULA: Circle theorems
F: Angle in a semicircle = 90° · angle at the centre = 2 × angle at the circumference
F: Tangent ⟂ radius at the point of contact · two tangents from a point are equal
F: Tangent length from a point at distance d = √(d² − r²)
T: Draw the radius to every point of contact.
E: d = 13, r = 5 → tangent = 12.

## Quant › Trigonometry
FORMULA: Trigonometric identities
F: sin²θ + cos²θ = 1 · 1 + tan²θ = sec²θ · 1 + cot²θ = cosec²θ
T: sec² − tan² = 1 and cosec² − cot² = 1 are the same identities rearranged.
E: If sec θ + tan θ = 2, then sec θ − tan θ = 1/2.

FORMULA: Standard values
F: θ: 0°, 30°, 45°, 60°, 90°
F: sin: 0, 1/2, 1/√2, √3/2, 1 · cos: 1, √3/2, 1/√2, 1/2, 0 · tan: 0, 1/√3, 1, √3, not defined
T: sin values = √0/2, √1/2, √2/2, √3/2, √4/2; cos is the same list backwards.
E: sin 30° + cos 60° = 1/2 + 1/2 = 1.

FORMULA: Complementary angles
F: sin(90° − θ) = cos θ · tan(90° − θ) = cot θ · sec(90° − θ) = cosec θ
F: If A + B = 90°: sin A = cos B and tan A × tan B = 1
T: "Co" functions swap.
E: tan 20° × tan 70° = 1.

## Quant › Number Series
FORMULA: Number series checklist
F: Check in this order: differences (1st, 2nd) → × or ÷ pattern → squares / cubes ± k → alternate series → × n + n
T: Slow growth → differences; fast growth → multiplication; explosive growth → × n + k.
E: 2, 6, 12, 20, 30 → n(n + 1) → next 42.

## Quant › Data Interpretation
FORMULA: DI essentials
F: Share of total = part / total × 100 · growth % = (new − old)/old × 100
F: Average = total / number of years or items
T: Approximate early: round to easy figures and use the fraction-percentage table.
E: Sales 240 → 300: growth = 60/240 = 25%.

## Quant › Probability
FORMULA: Probability basics
F: P(E) = favourable outcomes / total outcomes · P(not E) = 1 − P(E)
F: P(A or B) = P(A) + P(B) − P(A and B)
F: Two dice: 36 outcomes · a pack of cards: 52 (4 suits of 13, 26 red, 12 face cards, 4 aces)
T: "At least one" = 1 − P(none).
E: Two coins, at least one head = 1 − 1/4 = 3/4.

## Quant › Permutation & Combination
FORMULA: Permutations and combinations
F: nPr = n!/(n − r)! · nCr = n!/(r!(n − r)!) · nCr = nC(n − r)
F: Arrangements of a word with repeated letters = n!/(p! q! …) · round table = (n − 1)!
T: Order matters → permutation; just choosing → combination.
E: LEVEL: 5!/(2! × 2!) = 30 arrangements.

## Quant › Statistics
FORMULA: Mean, median and mode
F: Median = middle value of the sorted data (average of the two middle values if the count is even)
F: Empirical relation: Mode = 3 × Median − 2 × Mean
T: Sort first, always.
E: 3, 7, 8, 10, 12 → median 8.

## Reasoning › Syllogism
FORMULA: Definite conclusions
F: All + All = All · All + No = No · Some + All = Some · Some + No = Some … not
F: No + All = Some … not, reversed (No A is B + All B are C → Some C are not A)
F: All + Some, Some + Some, No + No, Some not + anything → no definite conclusion
T: Draw the smallest Venn diagram that fits the statements; a "possible" conclusion holds if one diagram allows it.
E: All pens are books + No book is a copy → No pen is a copy.

FORMULA: Either-or (complementary pair)
F: "Either I or II follows" when the two conclusions are about the same two terms, neither follows on its own, and they cover every case
F: Pairs: Some + No, All + Some not
T: Check the subject and predicate are the same in both conclusions.
E: Some A are B / No A is B (neither definite) → either I or II follows.

## Reasoning › Inequality
FORMULA: Reading inequalities
F: Combine along the chain: > with ≥ gives >, = keeps the sign, ≥ with ≥ gives ≥
F: Signs in opposite directions (> and <) → no relation
T: Same direction = connected; opposite = no relation.
E: A > B ≥ C = D → A > D is true; A ≥ D is false.

## Reasoning › Blood Relations
FORMULA: Family tree method
F: + male, − female, = married couple, vertical line = next generation, horizontal line = siblings
T: Start from the person the question is about; the only son of my grandfather is my father (or uncle if he had more sons).
E: "A is the brother of B's mother" → A is B's maternal uncle.

## Reasoning › Direction Sense
FORMULA: Turns and distances
F: Right turn = 90° clockwise · left turn = 90° anticlockwise
F: Shortest distance = √(x² + y²) (Pythagoras)
F: Morning: the shadow falls to the West · evening: the shadow falls to the East
T: Draw every step on paper with North up.
E: 3 km North, then 4 km East → 5 km from the start, North-East.

## Reasoning › Coding-Decoding
FORMULA: Letter positions
F: E J O T Y = 5, 10, 15, 20, 25
F: Opposite letters add to 27: A–Z, B–Y, C–X … M–N · position from the end = 27 − position from the start
T: "EJOTY" for positions, "27" for opposite letters.
E: R is 18th → its opposite is 27 − 18 = 9th letter, I.

## Reasoning › Order & Ranking
FORMULA: Ranks from both ends
F: Total = rank from left + rank from right − 1
F: Rank from right = total − rank from left + 1
T: The person is counted twice, so subtract 1.
E: 7th from the left and 12th from the right → 18 people.

## Reasoning › Calendar
FORMULA: Odd days
F: Normal year = 1 odd day · leap year = 2 · 100 years = 5 · 200 = 3 · 300 = 1 · 400 = 0
F: Leap year: divisible by 4; a century year only if divisible by 400
F: Odd days per month: Jan 3, Feb 0 (1 in a leap year), Mar 3, Apr 2, May 3, Jun 2, Jul 3, Aug 3, Sep 2, Oct 3, Nov 2, Dec 3
T: Count odd days and move that many weekdays forward.
E: 1 Jan 2025 was a Wednesday; 2025 is a normal year → 1 Jan 2026 is a Thursday.

## Reasoning › Clocks
FORMULA: Angle between the hands
F: Angle = |30H − 5.5M| (take 360° minus this if it is more than 180°)
F: The hands coincide 11 times in 12 hours (22 a day); they are at right angles 22 times in 12 hours (44 a day)
T: The minute hand gains 5.5° per minute on the hour hand.
E: 3:40 → |90 − 220| = 130°.

FORMULA: Mirror image of a clock
F: Mirror time = 11:60 − actual time (for times between 1:00 and 11:00)
T: Subtract from 11:60; from 12:00 → 12:00.
E: 3:20 → 11:60 − 3:20 = 8:40.

## Reasoning › Seating Arrangement
FORMULA: Left and right
F: Facing the centre: left = clockwise, right = anticlockwise
F: Facing outside: left = anticlockwise, right = clockwise
F: In a row facing North: your right is the viewer's right; facing South: it is reversed
T: Draw the circle and mark each person's own right with an arrow.
E: Facing the centre, "2nd to the right of A" → count 2 seats anticlockwise from A.

## Reasoning › Puzzles
FORMULA: Solving puzzles
F: Start with definite information, make a table, add negative clues (who is NOT where), then try cases and drop the ones that fail
T: Fix the most constrained person or item first.
E: 5 floors; "P lives on an odd floor above Q, who is on floor 2" → P is on floor 3 or 5.

## Reasoning › Data Sufficiency
FORMULA: Standard answer choices
F: (1) I alone is enough · (2) II alone is enough · (3) either alone is enough · (4) both together are needed · (5) even both are not enough
T: Test each statement on its own first; combine only if neither works alone.
E: "Is x > 0?" I: x² = 4 (no — x could be −2), II: x³ = 8 (yes) → II alone.

## Reasoning › Statement & Conclusion
FORMULA: Assumptions, conclusions and courses of action
F: Assumption = something taken for granted, not stated · conclusion = must follow from the statement alone
F: Course of action = practical, removes or reduces the problem, not extreme
T: Reject choices with extreme words: only, all, always, never, completely.
E: "Use Brand X toothpaste for whiter teeth" → assumption: people want whiter teeth.

## Reasoning › Venn Diagrams
FORMULA: Counting with sets
F: n(A ∪ B) = n(A) + n(B) − n(A ∩ B)
F: n(A ∪ B ∪ C) = n(A) + n(B) + n(C) − n(A∩B) − n(B∩C) − n(A∩C) + n(A∩B∩C)
T: Fill the middle (all three) first, then work outwards.
E: 40 like tea, 30 like coffee, 10 like both → 60 like at least one.

## Reasoning › Alphanumeric Series
FORMULA: Position counting in a series
F: Position from the right = total − position from the left + 1
F: "k-th element to the left of the m-th from the right" → (m + k)-th from the right
T: Remove the elements the question excludes before counting.
E: In a 26-letter alphabet, the 7th from the right is the 20th from the left (T).

## Quant › Geometry
FORMULA: Pythagoras theorem
F: In a right-angled triangle: Hypotenuse² = Base² + Perpendicular² (h² = b² + p²)
F: Converse: if h² = b² + p², the angle opposite h is 90°
T: The hypotenuse is opposite the right angle and is the longest side. Triplets: (3, 4, 5), (5, 12, 13), (8, 15, 17).
E: Base 6, perpendicular 8 → hypotenuse = √(36 + 64) = 10.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="45,25 45,135 200,135" fill="none" stroke="currentColor" stroke-width="2"/><path d="M45,127 L53,127 L53,135" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="45" y1="25" x2="200" y2="135" stroke="currentColor" stroke-width="2" class="hl"/><text x="38.7" y="20.6" font-size="13" text-anchor="middle">A</text><text x="36" y="145.9" font-size="13" text-anchor="middle">B</text><text x="210.4" y="143.2" font-size="13" text-anchor="middle">C</text><text x="30" y="84" font-size="13" text-anchor="middle" font-style="italic">p</text><text x="122" y="151" font-size="13" text-anchor="middle" font-style="italic">b</text><text x="130" y="72" font-size="13" text-anchor="middle" font-style="italic" class="hl">h</text></svg>

FORMULA: Exterior angle theorem
F: Exterior angle of a triangle = sum of the two interior opposite angles (∠ACD = ∠A + ∠B)
F: Angle sum property: ∠A + ∠B + ∠C = 180°
T: "Outside = the two far insides".
E: ∠A = 50°, ∠B = 60° → exterior angle at C = 110° and ∠C = 70°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="95,25 25,130 165,130" fill="none" stroke="currentColor" stroke-width="2"/><line x1="165" y1="130" x2="228" y2="130" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M102.8,36.6 A14,14 0 0 1 87.2,36.6" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="95" y="53" font-size="11" text-anchor="middle" class="hl">a</text><path d="M33.9,116.7 A16,16 0 0 1 41,130" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="48.8" y="121.3" font-size="11" text-anchor="middle" class="hl">b</text><path d="M156.1,116.7 A16,16 0 0 1 181,130" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="181" y="104" font-size="11" text-anchor="middle" class="hl">a + b</text><text x="95" y="18.6" font-size="13" text-anchor="middle">A</text><text x="15.2" y="139.5" font-size="13" text-anchor="middle">B</text><text x="165" y="148" font-size="13" text-anchor="middle">C</text><text x="224" y="148" font-size="13" text-anchor="middle">D</text></svg>

FORMULA: Centroid (medians meet in the ratio 2 : 1)
F: A median joins a vertex to the midpoint of the opposite side; the three medians meet at the centroid G
F: G divides each median 2 : 1 from the vertex (AG : GD = 2 : 1)
F: Apollonius' theorem: AB² + AC² = 2(AD² + BD²) for the median AD
T: The centroid is the balance point; the medians cut the triangle into 6 triangles of equal area.
E: Median AD = 9 cm → AG = 6 cm, GD = 3 cm.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="110,18 22,140 218,140" fill="none" stroke="currentColor" stroke-width="2"/><line x1="110" y1="18" x2="120" y2="140" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="22" y1="140" x2="164" y2="79" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="218" y1="140" x2="66" y2="79" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="116.7" cy="99.3" r="2.5" fill="currentColor"/><text x="128.7" y="95.3" font-size="13" text-anchor="middle" class="hl">G</text><text x="109.1" y="11.6" font-size="13" text-anchor="middle">A</text><text x="11.9" y="148.9" font-size="13" text-anchor="middle">B</text><text x="228.2" y="148.6" font-size="13" text-anchor="middle">C</text><circle cx="120" cy="140" r="2" fill="currentColor"/><text x="120" y="155" font-size="12" text-anchor="middle">D</text><line x1="71" y1="145" x2="71" y2="135" stroke="currentColor" stroke-width="1.5"/><line x1="169" y1="145" x2="169" y2="135" stroke="currentColor" stroke-width="1.5"/><text x="126" y="62.7" font-size="12" text-anchor="middle" class="hl">2</text><text x="128.7" y="127.7" font-size="12" text-anchor="middle" class="hl">1</text></svg>

FORMULA: Incentre (angle bisectors meet)
F: The angle bisectors meet at the incentre I, the centre of the incircle (equally far from all three sides)
F: ∠BIC = 90° + ∠A/2 · inradius r = Area / s (s = semi-perimeter)
F: Right triangle: r = (a + b − c)/2, c = hypotenuse
T: "In-centre: 90 plus half".
E: ∠A = 60° → ∠BIC = 120°. Right triangle 3, 4, 5 → r = (3 + 4 − 5)/2 = 1.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="95,18 22,140 218,140" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="104.5" cy="93.2" r="46.8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><line x1="95" y1="18" x2="104.5" y2="93.2" stroke="currentColor" stroke-width="1.5" class="hl"/><line x1="22" y1="140" x2="104.5" y2="93.2" stroke="currentColor" stroke-width="1.5" class="hl"/><line x1="218" y1="140" x2="104.5" y2="93.2" stroke="currentColor" stroke-width="1.5" class="hl"/><circle cx="104.5" cy="93.2" r="2.5" fill="currentColor"/><text x="113.5" y="87.2" font-size="13" text-anchor="middle" class="hl">I</text><text x="93.6" y="11.6" font-size="13" text-anchor="middle">A</text><text x="12.4" y="150" font-size="13" text-anchor="middle">B</text><text x="228.2" y="148.7" font-size="13" text-anchor="middle">C</text><path d="M115.6,97.8 A12,12 0 0 1 94,99.2" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="120" y="157" font-size="10" text-anchor="middle" class="hl">∠BIC = 90° + A/2</text></svg>

FORMULA: Circumcentre (perpendicular bisectors meet)
F: The perpendicular bisectors of the sides meet at the circumcentre O, the centre of the circle through A, B and C
F: ∠BOC = 2∠A (acute triangle) · circumradius R = abc / (4 × Area)
F: Right triangle: O is the midpoint of the hypotenuse, so R = hypotenuse / 2
T: "Circum: double".
E: ∠A = 55° → ∠BOC = 110°. Right triangle 6, 8, 10 → R = 5.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><polygon points="109.2,18.9 69.2,115.6 170.8,115.6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="120" y1="80" x2="69.2" y2="115.6" stroke="currentColor" stroke-width="2" class="hl"/><line x1="120" y1="80" x2="170.8" y2="115.6" stroke="currentColor" stroke-width="2" class="hl"/><circle cx="120" cy="80" r="2.5" fill="currentColor"/><text x="110" y="74" font-size="13" text-anchor="middle" class="hl">O</text><text x="107.3" y="12.7" font-size="13" text-anchor="middle">A</text><text x="60.2" y="126.4" font-size="13" text-anchor="middle">B</text><text x="179.8" y="126.4" font-size="13" text-anchor="middle">C</text><path d="M116.8,30.7 A14,14 0 0 1 103.9,31.9" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="111.4" y="47.8" font-size="11" text-anchor="middle">x</text><path d="M129.8,86.9 A12,12 0 0 1 110.2,86.9" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="120" y="108" font-size="11" text-anchor="middle" class="hl">2x</text></svg>

FORMULA: Orthocentre (altitudes meet)
F: The altitudes (perpendiculars from each vertex to the opposite side) meet at the orthocentre H
F: ∠BHC = 180° − ∠A · in a right triangle H is the right-angled vertex
T: "Ortho: 180 minus". In an equilateral triangle the centroid, incentre, circumcentre and orthocentre are the same point.
E: ∠A = 70° → ∠BHC = 110°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="100,20 25,140 215,140" fill="none" stroke="currentColor" stroke-width="2"/><line x1="100" y1="20" x2="100" y2="140" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="25" y1="140" x2="124" y2="45.1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="215" y1="140" x2="78.4" y2="54.6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M100,133 L107,133 L107,140" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M119,49.9 L123.8,55 L128.9,50.1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M84.3,58.3 L88,52.4 L82.1,48.7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="68.1" r="2.5" fill="currentColor"/><text x="112" y="72.1" font-size="13" text-anchor="middle" class="hl">H</text><text x="98.2" y="13.7" font-size="13" text-anchor="middle">A</text><text x="15" y="149.1" font-size="13" text-anchor="middle">B</text><text x="225.2" y="148.6" font-size="13" text-anchor="middle">C</text></svg>

FORMULA: Basic proportionality theorem (Thales)
F: If DE ∥ BC, then AD/DB = AE/EC (and AD/AB = AE/AC = DE/BC)
F: Converse: if AD/DB = AE/EC, then DE ∥ BC
T: A line parallel to one side cuts the other two sides in the same ratio.
E: AD = 4, DB = 6, AE = 6 → EC = 9.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="110,18 25,140 215,140" fill="none" stroke="currentColor" stroke-width="2"/><line x1="71.8" y1="72.9" x2="157.2" y2="72.9" stroke="currentColor" stroke-width="2" class="hl"/><text x="109.1" y="11.6" font-size="13" text-anchor="middle">A</text><text x="14.9" y="149" font-size="13" text-anchor="middle">B</text><text x="225.2" y="148.8" font-size="13" text-anchor="middle">C</text><text x="61.8" y="76.9" font-size="13" text-anchor="middle" class="hl">D</text><text x="167.2" y="76.9" font-size="13" text-anchor="middle" class="hl">E</text><text x="120" y="150" font-size="11" text-anchor="middle" class="hl">DE ∥ BC</text></svg>

FORMULA: Angle bisector theorem
F: If AD bisects ∠A, then BD/DC = AB/AC
T: The bisector divides the opposite side in the ratio of the two sides next to the angle.
E: AB = 6, AC = 9, BC = 10 → BD = 10 × 6/15 = 4, DC = 6.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="80,20 20,140 220,140" fill="none" stroke="currentColor" stroke-width="2"/><line x1="80" y1="20" x2="104.2" y2="140" stroke="currentColor" stroke-width="2" class="hl"/><path d="M84.4,41.6 A22,22 0 0 1 70.2,39.7" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><path d="M99.7,36.9 A26,26 0 0 1 85.1,45.5" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="76.5" y="14.1" font-size="13" text-anchor="middle">A</text><text x="10" y="149.2" font-size="13" text-anchor="middle">B</text><text x="230.4" y="148.2" font-size="13" text-anchor="middle">C</text><text x="104.2" y="155" font-size="13" text-anchor="middle" class="hl">D</text></svg>

FORMULA: Midpoint theorem
F: The line joining the midpoints of two sides is parallel to the third side and half of it (DE ∥ BC, DE = ½ BC)
T: Midpoints → half and parallel.
E: BC = 14 cm → DE = 7 cm.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="110,18 25,140 215,140" fill="none" stroke="currentColor" stroke-width="2"/><line x1="67.5" y1="79" x2="162.5" y2="79" stroke="currentColor" stroke-width="2" class="hl"/><line x1="84.6" y1="45.6" x2="92.9" y2="51.4" stroke="currentColor" stroke-width="1.5"/><line x1="42.1" y1="106.6" x2="50.4" y2="112.4" stroke="currentColor" stroke-width="1.5"/><line x1="131.2" y1="50.2" x2="138.7" y2="43.7" stroke="currentColor" stroke-width="1.5"/><line x1="133.8" y1="53.3" x2="141.3" y2="46.8" stroke="currentColor" stroke-width="1.5"/><line x1="183.7" y1="111.2" x2="191.2" y2="104.7" stroke="currentColor" stroke-width="1.5"/><line x1="186.3" y1="114.3" x2="193.8" y2="107.8" stroke="currentColor" stroke-width="1.5"/><text x="109.1" y="11.6" font-size="13" text-anchor="middle">A</text><text x="14.9" y="149" font-size="13" text-anchor="middle">B</text><text x="225.2" y="148.8" font-size="13" text-anchor="middle">C</text><text x="57.5" y="83" font-size="13" text-anchor="middle" class="hl">D</text><text x="172.5" y="83" font-size="13" text-anchor="middle" class="hl">E</text><text x="120" y="150" font-size="11" text-anchor="middle" class="hl">DE = ½ BC</text></svg>

FORMULA: Areas of similar triangles
F: Similar triangles (AA, SAS or SSS similarity) have proportional sides
F: Ratio of areas = (ratio of corresponding sides)² = (ratio of heights, medians or perimeters)²
T: Sides × k → area × k².
E: Sides in the ratio 2 : 3 → areas in the ratio 4 : 9.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="50,50 15,120 95,120" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="170,20 115,130 235,130" fill="none" stroke="currentColor" stroke-width="2" class="hl"/><text x="55" y="140" font-size="12" text-anchor="middle" font-style="italic">k</text><text x="175" y="148" font-size="12" text-anchor="middle" font-style="italic" class="hl">k × s</text><text x="55" y="100" font-size="11" text-anchor="middle">area A</text><text x="175" y="105" font-size="11" text-anchor="middle" class="hl">area A × s²</text></svg>

FORMULA: Tangent–radius theorem
F: A tangent is perpendicular to the radius at the point of contact (OT ⟂ tangent at T)
T: In every tangent question draw the radius to the point of contact and look for the right angle.
E: OT = 5 and P on the tangent with OP = 13 → PT = √(169 − 25) = 12.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="85" cy="80" r="48" fill="none" stroke="currentColor" stroke-width="2"/><line x1="85" y1="80" x2="85" y2="32" stroke="currentColor" stroke-width="2"/><line x1="10" y1="32" x2="195" y2="32" stroke="currentColor" stroke-width="2" class="hl"/><path d="M85,40 L93,40 L93,32" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="85" cy="80" r="2.5" fill="currentColor"/><text x="85" y="96" font-size="13" text-anchor="middle">O</text><text x="85" y="24" font-size="13" text-anchor="middle">T</text><text x="185" y="24" font-size="11" text-anchor="middle" class="hl">tangent</text></svg>

FORMULA: Tangents from an external point
F: The two tangents from an outside point are equal: PA = PB
F: OP bisects ∠APB and ∠AOB · ∠APB + ∠AOB = 180°
F: Tangent length = √(d² − r²), where d = OP
T: OAPB is a kite with right angles at A and B.
E: r = 7, d = 25 → PA = √(625 − 49) = 24.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="70" cy="80" r="42" fill="none" stroke="currentColor" stroke-width="2"/><line x1="212" y1="80" x2="82.4" y2="39.9" stroke="currentColor" stroke-width="2" class="hl"/><line x1="212" y1="80" x2="82.4" y2="120.1" stroke="currentColor" stroke-width="2" class="hl"/><line x1="70" y1="80" x2="82.4" y2="39.9" stroke="currentColor" stroke-width="2"/><line x1="70" y1="80" x2="82.4" y2="120.1" stroke="currentColor" stroke-width="2"/><line x1="70" y1="80" x2="212" y2="80" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M80.4,46.6 L87,48.6 L89.1,41.9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M80.4,113.4 L87,111.4 L89.1,118.1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="148.7" y1="55.2" x2="145.7" y2="64.7" stroke="currentColor" stroke-width="1.5" class="hl"/><line x1="145.7" y1="95.3" x2="148.7" y2="104.8" stroke="currentColor" stroke-width="1.5" class="hl"/><circle cx="70" cy="80" r="2.5" fill="currentColor"/><text x="60" y="85" font-size="13" text-anchor="middle">O</text><text x="80.4" y="31.9" font-size="13" text-anchor="middle">A</text><text x="80.4" y="137.1" font-size="13" text-anchor="middle">B</text><text x="223" y="85" font-size="13" text-anchor="middle">P</text><text x="120" y="96" font-size="12" text-anchor="middle" font-style="italic">r</text><text x="150" y="74" font-size="12" text-anchor="middle" font-style="italic">d</text></svg>

FORMULA: Angle in a semicircle
F: The angle in a semicircle is a right angle: if AB is a diameter, ∠ACB = 90°
T: Diameter ⇒ right angle at the circumference.
E: Diameter AB = 10, AC = 6 → BC = 8.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="82" r="62" fill="none" stroke="currentColor" stroke-width="2"/><line x1="58" y1="82" x2="182" y2="82" stroke="currentColor" stroke-width="2"/><polyline points="58,82 90.9,27.3 182,82" fill="none" stroke="currentColor" stroke-width="2" class="hl"/><path d="M86.3,35 L94,39.6 L98.6,31.9" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><circle cx="120" cy="82" r="2.5" fill="currentColor"/><text x="120" y="98" font-size="13" text-anchor="middle">O</text><text x="48" y="87" font-size="13" text-anchor="middle">A</text><text x="192" y="87" font-size="13" text-anchor="middle">B</text><text x="84.9" y="20.3" font-size="13" text-anchor="middle">C</text></svg>

FORMULA: Angle at the centre theorem
F: An arc subtends at the centre twice the angle it subtends at any point on the rest of the circle: ∠AOB = 2∠ACB
T: Centre = double.
E: ∠ACB = 40° → ∠AOB = 80°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="2"/><line x1="69.2" y1="115.6" x2="120" y2="80" stroke="currentColor" stroke-width="2" class="hl"/><line x1="170.8" y1="115.6" x2="120" y2="80" stroke="currentColor" stroke-width="2" class="hl"/><line x1="69.2" y1="115.6" x2="109.2" y2="18.9" stroke="currentColor" stroke-width="2"/><line x1="170.8" y1="115.6" x2="109.2" y2="18.9" stroke="currentColor" stroke-width="2"/><path d="M129.8,86.9 A12,12 0 0 1 110.2,86.9" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="120" y="108" font-size="11" text-anchor="middle" class="hl">2x</text><path d="M117.8,32.4 A16,16 0 0 1 103.1,33.7" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="111.6" y="49.8" font-size="11" text-anchor="middle">x</text><circle cx="120" cy="80" r="2.5" fill="currentColor"/><text x="108" y="76" font-size="13" text-anchor="middle">O</text><text x="60.2" y="126.4" font-size="13" text-anchor="middle">A</text><text x="179.8" y="126.4" font-size="13" text-anchor="middle">B</text><text x="107.3" y="12.7" font-size="13" text-anchor="middle">C</text></svg>

FORMULA: Angles in the same segment
F: Angles subtended by the same chord in the same segment are equal: ∠ACB = ∠ADB
T: Same chord, same side → same angle (a "bow-tie").
E: ∠ACB = 35° → ∠ADB = 35°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="2"/><line x1="63.8" y1="106.2" x2="176.2" y2="106.2" stroke="currentColor" stroke-width="2"/><line x1="63.8" y1="106.2" x2="84.4" y2="29.2" stroke="currentColor" stroke-width="2"/><line x1="176.2" y1="106.2" x2="84.4" y2="29.2" stroke="currentColor" stroke-width="2"/><line x1="63.8" y1="106.2" x2="151" y2="26.3" stroke="currentColor" stroke-width="2"/><line x1="176.2" y1="106.2" x2="151" y2="26.3" stroke="currentColor" stroke-width="2"/><path d="M96.7,39.5 A16,16 0 0 1 80.3,44.7" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="92.6" y="59" font-size="11" text-anchor="middle" class="hl">x</text><path d="M155.8,41.6 A16,16 0 0 1 139.2,37.1" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="144" y="56.4" font-size="11" text-anchor="middle" class="hl">x</text><text x="53.8" y="115.4" font-size="13" text-anchor="middle">A</text><text x="186.2" y="115.4" font-size="13" text-anchor="middle">B</text><text x="78.1" y="24.8" font-size="13" text-anchor="middle">C</text><text x="156.5" y="21.3" font-size="13" text-anchor="middle">D</text></svg>

FORMULA: Cyclic quadrilateral
F: Opposite angles of a cyclic quadrilateral add up to 180°: ∠A + ∠C = ∠B + ∠D = 180°
F: An exterior angle equals the interior opposite angle
T: Cyclic → opposite angles are supplementary.
E: ∠A = 75° → ∠C = 105°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="66.3,49 69.2,115.6 167.5,119.9 163.8,36.2" fill="none" stroke="currentColor" stroke-width="2" class="hl"/><path d="M81.2,47 A15,15 0 0 1 67,64" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="86.2" y="69.7" font-size="11" text-anchor="middle" class="hl">x</text><path d="M152.5,119.2 A15,15 0 0 1 166.8,104.9" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="188.7" y="145.1" font-size="11" text-anchor="middle" class="hl">180° − x</text><text x="56.8" y="48" font-size="13" text-anchor="middle">A</text><text x="60.2" y="126.4" font-size="13" text-anchor="middle">B</text><text x="175.9" y="131.5" font-size="13" text-anchor="middle">C</text><text x="171.6" y="32.9" font-size="13" text-anchor="middle">D</text></svg>

FORMULA: Alternate segment theorem
F: The angle between a tangent and a chord at the point of contact equals the angle in the alternate segment: ∠TAB = ∠ACB
T: Tangent–chord angle = the angle on the other side of the chord.
E: ∠TAB = 50° → ∠ACB = 50°.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="115" cy="72" r="55" fill="none" stroke="currentColor" stroke-width="2"/><line x1="20" y1="127" x2="225" y2="127" stroke="currentColor" stroke-width="2"/><line x1="115" y1="127" x2="166.7" y2="53.2" stroke="currentColor" stroke-width="2" class="hl"/><line x1="115" y1="127" x2="67.4" y2="44.5" stroke="currentColor" stroke-width="2"/><line x1="166.7" y1="53.2" x2="67.4" y2="44.5" stroke="currentColor" stroke-width="2"/><path d="M125.3,112.3 A18,18 0 0 1 133,127" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="139.8" y="118.1" font-size="11" text-anchor="middle" class="hl">x</text><path d="M83.3,45.9 A16,16 0 0 1 75.4,58.4" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="90.1" y="63" font-size="11" text-anchor="middle" class="hl">x</text><text x="115" y="143" font-size="13" text-anchor="middle">A</text><text x="177" y="54" font-size="13" text-anchor="middle">B</text><text x="57.8" y="43.5" font-size="13" text-anchor="middle">C</text><text x="217" y="121" font-size="12" text-anchor="middle">T</text></svg>

FORMULA: Intersecting chords theorem
F: If chords AB and CD meet at P inside the circle: PA × PB = PC × PD
T: "Part × part = part × part".
E: PA = 4, PB = 6, PC = 3 → PD = 8.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="120" cy="80" r="62" fill="none" stroke="currentColor" stroke-width="2"/><line x1="61.7" y1="58.8" x2="178.3" y2="101.2" stroke="currentColor" stroke-width="2" class="hl"/><line x1="141.2" y1="21.7" x2="93.8" y2="136.2" stroke="currentColor" stroke-width="2"/><circle cx="117.5" cy="79.1" r="2.5" fill="currentColor"/><text x="129.5" y="73.1" font-size="13" text-anchor="middle" class="hl">P</text><text x="51.4" y="59.6" font-size="13" text-anchor="middle">A</text><text x="188.6" y="109.5" font-size="13" text-anchor="middle">B</text><text x="145" y="16" font-size="13" text-anchor="middle">C</text><text x="89.1" y="150.7" font-size="13" text-anchor="middle">D</text></svg>

FORMULA: Tangent–secant theorem
F: From an outside point P with tangent PT and secant PAB: PT² = PA × PB
F: Two secants PAB and PCD: PA × PB = PC × PD
T: "Tangent squared = outside part × whole".
E: PA = 4, PB = 9 → PT = 6.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="150" cy="80" r="48" fill="none" stroke="currentColor" stroke-width="2"/><line x1="22" y1="80" x2="132" y2="35.5" stroke="currentColor" stroke-width="2" class="hl"/><line x1="22" y1="80" x2="179.6" y2="117.8" stroke="currentColor" stroke-width="2"/><path d="M134.6,42 L128.1,44.6 L125.5,38.1" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="150" y1="80" x2="132" y2="35.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="150" cy="80" r="2.5" fill="currentColor"/><text x="154" y="74" font-size="13" text-anchor="middle">O</text><text x="14" y="85" font-size="13" text-anchor="middle">P</text><text x="128" y="27.5" font-size="13" text-anchor="middle">T</text><text x="102.5" y="116.3" font-size="13" text-anchor="middle">A</text><text x="187.6" y="131.8" font-size="13" text-anchor="middle">B</text></svg>

## Quant › Mensuration
FORMULA: Heron's formula
F: Area of a triangle = √(s(s − a)(s − b)(s − c)), where s = (a + b + c)/2
T: Work out s first; use it when only the three sides are known.
E: Sides 13, 14, 15 → s = 21, area = √(21 × 8 × 7 × 6) = 84.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="70,22 22,135 212,135" fill="none" stroke="currentColor" stroke-width="2"/><text x="65.8" y="16.4" font-size="13" text-anchor="middle">A</text><text x="12.1" y="144.3" font-size="13" text-anchor="middle">B</text><text x="222.4" y="143.1" font-size="13" text-anchor="middle">C</text><text x="36" y="78" font-size="13" text-anchor="middle" font-style="italic">c</text><text x="117" y="151" font-size="13" text-anchor="middle" font-style="italic">a</text><text x="150" y="74" font-size="13" text-anchor="middle" font-style="italic">b</text><text x="128" y="112" font-size="11" text-anchor="middle" class="hl">s = (a + b + c)/2</text></svg>

FORMULA: Sector and arc of a circle
F: Arc length l = (θ/360) × 2πr · Area of a sector = (θ/360) × πr² = ½ × l × r
T: A sector is the fraction θ/360 of the whole circle.
E: r = 14, θ = 90° → arc = 22, sector area = 154.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="80" cy="95" r="62" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><path d="M80,95 L139.9,79 A62,62 0 0 0 85.4,33.2 Z" fill="none" stroke="currentColor" stroke-width="2" class="hl"/><path d="M81.2,81.1 A14,14 0 0 1 93.5,91.4" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="95.4" y="80.6" font-size="11" text-anchor="middle" class="hl">θ</text><circle cx="80" cy="95" r="2.5" fill="currentColor"/><text x="70" y="109" font-size="13" text-anchor="middle">O</text><text x="120" y="107" font-size="12" text-anchor="middle" font-style="italic">r</text><text x="158" y="50" font-size="12" text-anchor="middle" class="hl">arc l</text><text x="112" y="72" font-size="11" text-anchor="middle" class="hl">sector</text></svg>

FORMULA: Cylinder
F: Volume = πr²h · Curved surface area = 2πrh · Total surface area = 2πr(r + h)
T: The curved surface unrolls into a rectangle 2πr × h (like the label of a can).
E: r = 7, h = 10 → volume 1540, curved surface 440.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><ellipse cx="95" cy="30" rx="52" ry="13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M43,130 A52,13 0 0 0 147,130" fill="none" stroke="currentColor" stroke-width="2"/><path d="M43,130 A52,13 0 0 1 147,130" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="43" y1="30" x2="43" y2="130" stroke="currentColor" stroke-width="2"/><line x1="147" y1="30" x2="147" y2="130" stroke="currentColor" stroke-width="2"/><line x1="95" y1="130" x2="147" y2="130" stroke="currentColor" stroke-width="2" class="hl"/><line x1="161" y1="30" x2="161" y2="130" stroke="currentColor" stroke-width="2" class="hl"/><text x="121" y="125" font-size="12" text-anchor="middle" font-style="italic" class="hl">r</text><text x="171" y="80" font-size="12" text-anchor="middle" font-style="italic" class="hl">h</text></svg>

FORMULA: Cone
F: Volume = ⅓πr²h · slant height l = √(r² + h²) · Curved surface area = πrl · Total surface area = πr(l + r)
T: A cone is one-third of the cylinder with the same base and height.
E: r = 3, h = 4 → l = 5, curved surface = 15π.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><line x1="95" y1="18" x2="40" y2="130" stroke="currentColor" stroke-width="2"/><line x1="95" y1="18" x2="150" y2="130" stroke="currentColor" stroke-width="2" class="hl"/><path d="M40,130 A55,13 0 0 0 150,130" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40,130 A55,13 0 0 1 150,130" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="95" y1="18" x2="95" y2="130" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="95" y1="130" x2="150" y2="130" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M95,123 L102,123 L102,130" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="87" y="80" font-size="12" text-anchor="middle" font-style="italic">h</text><text x="122.5" y="125" font-size="12" text-anchor="middle" font-style="italic">r</text><text x="135" y="70" font-size="13" text-anchor="middle" font-style="italic" class="hl">l</text></svg>

FORMULA: Sphere and hemisphere
F: Sphere: volume = (4/3)πr³, surface area = 4πr²
F: Hemisphere: volume = (2/3)πr³, curved surface = 2πr², total surface = 3πr²
T: A sphere's surface = 4 circles of the same radius.
E: r = 21 → sphere volume = 4/3 × 22/7 × 9261 = 38,808.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><circle cx="95" cy="80" r="58" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="95" cy="80" rx="58" ry="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="95" y1="80" x2="153" y2="80" stroke="currentColor" stroke-width="2" class="hl"/><circle cx="95" cy="80" r="2.5" fill="currentColor"/><text x="124" y="74" font-size="12" text-anchor="middle" font-style="italic" class="hl">r</text><text x="87" y="96" font-size="13" text-anchor="middle">O</text></svg>

## Quant › Trigonometry
FORMULA: Trigonometric ratios
F: sin θ = P/H · cos θ = B/H · tan θ = P/B (P = perpendicular, B = base, H = hypotenuse)
F: cosec θ = H/P · sec θ = H/B · cot θ = B/P
T: "Pandit Badri Prasad, Har Har Bole": sin = P/H, cos = B/H, tan = P/B.
E: P = 3, B = 4, H = 5 → sin θ = 3/5, cos θ = 4/5, tan θ = 3/4.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><polygon points="30,135 200,135 200,30" fill="none" stroke="currentColor" stroke-width="2"/><path d="M192,135 L192,127 L200,127" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50.4,122.4 A24,24 0 0 1 54,135" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="64.6" y="129.2" font-size="11" text-anchor="middle" class="hl">θ</text><text x="110" y="150" font-size="11" text-anchor="middle">Base (B)</text><text x="84" y="66" font-size="11" text-anchor="middle">Hypotenuse (H)</text><text x="206" y="86" font-size="11" text-anchor="start" class="hl">Perp.</text><text x="206" y="99" font-size="11" text-anchor="start" class="hl">(P)</text></svg>

FORMULA: Heights and distances
F: Angle of elevation θ from a distance d: tan θ = h / d, so h = d × tan θ
F: The angle of depression from the top equals the angle of elevation from the bottom (alternate angles)
T: 45° → h = d · 30° → h = d/√3 · 60° → h = d√3.
E: d = 30 m, θ = 60° → h = 30√3 ≈ 51.96 m.
FIG: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><line x1="25" y1="135" x2="205" y2="135" stroke="currentColor" stroke-width="2"/><line x1="205" y1="135" x2="205" y2="25" stroke="currentColor" stroke-width="3" class="hl"/><line x1="25" y1="135" x2="205" y2="25" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M197,135 L197,127 L205,127" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M47.2,121.4 A26,26 0 0 1 51,135" fill="none" stroke="currentColor" stroke-width="1.5" class="hl"/><text x="61.6" y="128.7" font-size="11" text-anchor="middle" class="hl">θ</text><text x="115" y="150" font-size="11" text-anchor="middle">distance d</text><text x="222" y="84" font-size="13" text-anchor="middle" font-style="italic" class="hl">h</text><text x="27" y="127" font-size="10" text-anchor="middle">eye</text><text x="150" y="66" font-size="10" text-anchor="middle">line of sight</text></svg>
`;
