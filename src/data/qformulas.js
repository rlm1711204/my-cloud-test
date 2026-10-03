// Built-in Formula Book for Maths & Reasoning. Same plain-text format as the copy-paste prompts:
//   ## Subject › Topic          (names must match src/lib/quant-taxonomy.js)
//   FORMULA: name               F: the formula or rule (several lines allowed)
//   T: trick / how to use it    E: a small worked example
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
`;
