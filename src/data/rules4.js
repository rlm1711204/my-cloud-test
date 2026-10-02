// Built-in Grammar Rule Book, part 4: ADVANCED rules (RBI Grade B / SEBI / NABARD level), with their exceptions.
// Format: see src/data/rules1.js. "D: 4" or "D: 5" marks a rule as advanced.
export default `
## Subject–Verb Agreement

# Quantity phrases: the noun after 'of' decides
R: With 'a lot of', 'lots of', 'plenty of', 'a majority of', 'the rest of' and 'a percentage of', the verb agrees with the noun that follows 'of': singular for an uncountable or singular noun, plural for a plural noun.
N: 'The majority' used alone is singular when it means the group as one body: 'The majority has spoken.' It is plural when the members are meant: 'The majority are in favour.'
E: A lot of work has been done.
E: A lot of people have applied.
E: A majority of the members were absent.
X: Plenty of food were wasted at the party. => Plenty of food was wasted at the party.
W: 'Food' is uncountable, so the verb is singular.
T: In RBI-style error spotting, look past the quantity phrase to the real noun.
Q: Lots of money ___ been spent on the project. | *has; have; are; were
Q: A majority of the shareholders ___ against the merger. | *were; was; is; has
D: 4

# Titles, names and quotations take a singular verb
R: The title of a book, film or newspaper, the name of a country or organisation, and a quoted word or phrase take a singular verb even if they look plural.
N: 'The Netherlands' and 'the Philippines' are singular as countries, but 'The Philippines are a group of islands' speaks of the islands themselves.
E: 'Great Expectations' is a novel by Dickens.
E: The United States has a federal system.
X: The Arabian Nights are an interesting book. => The Arabian Nights is an interesting book.
W: It is the title of one book.
Q: 'Pride and Prejudice' ___ my favourite novel. | *is; are; were; have been
Q: The United Nations ___ founded in 1945. | *was; were; are; have been
D: 4

# 'More than one' takes a singular noun and verb
R: 'More than one' is followed by a singular noun and a singular verb, even though the meaning is plural. But 'more + plural noun + than one' takes a plural verb.
N: This is a fixed exception to logic: the verb follows the word 'one'.
E: More than one candidate has applied for the post.
E: More candidates than one have applied.
X: More than one students were caught cheating. => More than one student was caught cheating.
W: After 'more than one', both the noun and the verb are singular.
Q: More than one bank ___ raised its interest rates. | *has; have; are; were
Q: More than one ___ was injured in the stampede. | *person; persons; people; peoples
D: 4

# Gerunds, infinitives and clauses as subjects are singular
R: When an -ing phrase, a 'to + verb' phrase or a whole clause (what…, that…, whether…) is the subject, the verb is singular, even if plural nouns come inside it.
N: Two separate -ing subjects joined by 'and' take a plural verb: 'Reading and writing are both important.'
E: Reading novels is my hobby.
E: What we need is more volunteers.
E: That the reforms were delayed was obvious.
X: Managing large teams require patience. => Managing large teams requires patience.
W: The subject is the action 'managing', not 'teams'.
Q: To err ___ human. | *is; are; were; be
Q: Whether the bank will lend us the money ___ still unclear. | *is; are; were; have been
D: 4

# The verb agrees with the subject, not with the complement
R: In 'subject + be + complement', the verb agrees with the subject BEFORE it, even when the noun after 'be' has a different number.
N: Turn the sentence round and the verb changes with it: 'Rising costs are our biggest problem.'
E: Our biggest problem is rising costs.
E: Rising costs are our biggest problem.
X: His only interest are books. => His only interest is books.
W: 'Interest' (singular) is the subject; 'books' is only the complement.
Q: The greatest danger ___ the floods that follow the storm. | *is; are; were; have been
Q: The floods that follow the storm ___ the greatest danger. | *are; is; was; has been
D: 4

# Inverted sentences: find the subject after the verb
R: When a sentence begins with 'here', 'there', or a phrase of place and the verb comes before the subject, the verb agrees with the subject that follows it.
N: 'Here's' with a plural noun is common in speech ('Here's your tickets') but is an error in exams.
E: Here comes the bus.
E: Here come the buses.
E: On the hill stand two old temples.
X: Here is the documents you asked for. => Here are the documents you asked for.
W: The subject 'documents' comes after the verb and is plural.
T: RBI error spotting often hides the subject at the end of an inverted sentence.
Q: Among the guests ___ the Governor and his wife. | *were; was; is; has been
Q: Behind every successful man ___ a woman. | *stands; stand; are standing; have stood
D: 5

# 'Nothing but', 'everyone except': the first word is the subject
R: In 'nothing but …', 'everyone except …', 'nobody but …', the subject is 'nothing', 'everyone' or 'nobody', so the verb is singular whatever follows 'but' or 'except'.
N: The old saying 'None but the brave deserve the fair' uses a plural verb; with 'none but' both forms are seen, but 'nothing but' and 'nobody except' are always singular.
E: Nothing but fears and doubts was left in his mind.
E: Everyone except the managers has received a bonus.
X: Nobody except the twins were present. => Nobody except the twins was present.
W: The subject is 'nobody'.
Q: Nothing but blue skies ___ in the forecast. | *is; are; were; have been
Q: Everyone except the two clerks ___ left the office. | *has; have; are; were
D: 4

## Pronouns

# 'Whoever' and 'whomever': the clause decides
R: Use 'whoever' when it is the subject of its own clause and 'whomever' when it is the object — even after a preposition, its own clause decides, not the preposition.
N: This is the exception to 'object form after a preposition': in 'to whoever is most qualified', 'whoever' is the subject of 'is'.
E: Give the prize to whoever answers first.
E: You may invite whomever you like.
X: The job will go to whomever is most qualified. => The job will go to whoever is most qualified.
W: 'Whoever' is the subject of 'is', even though it follows 'to'.
T: Cover everything outside the clause and test with he/him: 'he is most qualified' → whoever.
Q: Tell the story to ___ wants to hear it. | *whoever; whomever; whom; who ever
Q: She will marry ___ her parents choose. | *whomever; whoever; who; whichever
D: 5

# 'Than whom': the one exception after 'than'
R: Normally the pronoun after 'than' depends on the hidden verb ('taller than I am'). But when 'than' is followed by a relative pronoun, it is always 'whom': 'than whom'.
N: 'Than who' and 'than which' (for people) are errors; 'than which' is used only for things: 'a book than which none is better'.
E: Kalidasa, than whom no greater poet lived, wrote Shakuntala.
X: Gandhiji, than who no one was more truthful, led the movement. => Gandhiji, than whom no one was more truthful, led the movement.
W: 'Than whom' is the fixed form.
Q: Tagore, than ___ no Indian poet was more celebrated, won the Nobel Prize. | *whom; who; which; him
Q: Choose the correct sentence. | *He is a leader than whom none is braver.; He is a leader than who none is braver.; He is a leader than he none is braver.; He is a leader than whose none is braver.
D: 5

# 'Everyone', 'each': a singular pronoun in formal exams
R: Indefinite pronouns (anyone, everybody, someone, each, no one) are singular, so formal exam English uses 'his', 'his or her' or 'her' to refer back to them — not 'their'.
N: Modern English widely accepts singular 'they' ('Everyone brought their book'), but competitive exams still mark it as an error.
E: Everyone must do his or her duty.
X: Each of the candidates must bring their admit card. => Each of the candidates must bring his or her admit card.
W: 'Each' is singular, so the pronoun must be singular.
Q: Somebody has left ___ umbrella in the bank. | *his or her; their; theirs; its
Q: Every employee should submit ___ declaration by Friday. | *his or her; their; theirs; them
D: 4

# 'The same … as' and 'the same … that'
R: 'The same … as' means similar in kind; 'the same … that' means the very same thing. Don't use 'which' or 'who' after 'the same'.
N: 'The same as' is also used for a comparison without a clause: 'Her bag is the same as mine.'
E: This is the same watch as my father wore (one like it).
E: This is the same watch that my father wore (his very watch).
X: She wore the same dress which she wore last year. => She wore the same dress that she wore last year.
W: After 'the same', use 'that' or 'as', not 'which'.
Q: He made the same mistake ___ he made last year (the very same one). | *that; which; who; what
Q: My bag is the same colour ___ yours. | *as; than; that; like
D: 4

## Articles

# 'The more …, the more …'
R: In paired comparatives ('the more …, the better …'), 'the' comes before BOTH comparatives.
N: This 'the' is not the article but an old adverb meaning 'by that much' — which is why it is used with an adjective here.
E: The more you practise, the better you become.
E: The higher you climb, the colder it gets.
X: More he earns, more he wants. => The more he earns, the more he wants.
W: Both comparatives need 'the'.
Q: ___ sooner we start, the earlier we will finish. | *The; A; (no article); So
Q: The harder you work, ___ success you will have. | *the more; more; the most; much more
D: 4

# 'Kind of' and 'sort of': no article after them
R: After 'kind of', 'sort of' and 'type of', use the noun without 'a' or 'an'. 'This kind of' takes a singular noun and verb; 'these kinds of' takes plural ones.
N: 'These kind of mistakes' is common in speech but is an error in exams.
E: What kind of man is he?
E: This kind of mistake is common.
E: These kinds of mistakes are common.
X: What kind of a person would do this? => What kind of person would do this?
W: No article after 'kind of'.
Q: ___ kind of behaviour is unacceptable. | *This; These; Those; Such a
Q: ___ sorts of problems are difficult to solve. | *These; This; That; Each
D: 4

# Word order with 'such a', 'half an', 'so good a'
R: With 'such', 'quite', 'rather', 'half', 'what' (exclamation) and 'many', the article comes AFTER the word: such a, quite a, half an, what a, many a. With 'so', 'too', 'as' and 'how' + adjective, the article comes after the adjective: so good a man, too difficult a task.
N: 'A half hour' is also accepted (mainly American); 'half an hour' is the exam answer.
E: It was such a long journey.
E: She is quite a good singer.
E: He is too clever a man to be fooled.
X: It was a such beautiful day. => It was such a beautiful day.
W: 'Such' comes before 'a'.
Q: It took ___ to finish the work. | *half an hour; an half hour; a half an hour; half a hour
Q: He is ___ to be trusted with the job. | *too careless a worker; a too careless worker; too a careless worker; careless too a worker
D: 4

# 'Most', 'most of the' and 'the most'
R: 'Most' + noun (no 'the') speaks generally: 'Most people…'. 'Most of the' + noun speaks of a particular group. 'The most' makes a superlative.
N: 'A most' means 'very': 'It was a most interesting lecture.'
E: Most Indians love cricket.
E: Most of the students in this class are from Bihar.
E: She is the most hard-working employee.
X: Most of people like music. => Most people like music.
W: 'Most of' needs 'the' (or a pronoun) after it; for a general statement use 'most' alone.
Q: ___ birds can fly. | *Most; Most of; The most of; Mostly
Q: ___ the money was spent on advertising. | *Most of; Most; The most; Mostly of
D: 4

## Nouns

# Plurals of compound nouns
R: In a compound noun, the main word takes the plural: sons-in-law, passers-by, commanders-in-chief, lookers-on, courts-martial. When there is no main noun, add -s at the end: grown-ups, forget-me-nots.
N: Compounds written as one word add -s at the end: handfuls, cupfuls.
E: Both his sons-in-law are engineers.
E: The passers-by stopped to help.
X: Her brother-in-laws live in Pune. => Her brothers-in-law live in Pune.
W: 'Brother' is the main word, so it takes the plural.
Q: The ___ watched the accident in silence. | *passers-by; passer-bys; passers-bys; passer-by's
Q: Both his ___ attended the wedding. | *sons-in-law; son-in-laws; sons-in-laws; son-in-law's
D: 4

# Foreign plurals
R: Many words from Latin and Greek keep their own plurals: criterion → criteria, phenomenon → phenomena, datum → data, medium → media, analysis → analyses, crisis → crises, thesis → theses, curriculum → curricula, alumnus → alumni.
N: 'Data' and 'media' are often used as singular in modern English ('The data shows…'), but formal exams treat them as plural ('These data are…').
E: These criteria are important.
E: Several crises hit the economy in 2008.
X: This criteria is not acceptable. => This criterion is not acceptable.
W: 'Criteria' is plural; the singular is 'criterion'.
Q: The scientists studied this rare ___. | *phenomenon; phenomena; phenomenons; phenomenas
Q: Both ___ of the economy were discussed. | *analyses; analysis; analysises; analysis's
D: 4

## Adjectives & Comparison

# Order of adjectives
R: When several adjectives come before a noun, they follow this order: opinion → size → age → shape → colour → origin → material → purpose → noun.
N: Adjectives of the same kind are separated by a comma or 'and': 'a long, tiring journey'.
E: She bought a beautiful long red silk saree.
E: He lives in a big old wooden house.
X: She has a red beautiful silk saree. => She has a beautiful red silk saree.
W: Opinion (beautiful) comes before colour (red).
T: Remember OSASCOMP: Opinion, Size, Age, Shape, Colour, Origin, Material, Purpose.
Q: He bought ___. | *a nice new leather bag; a leather new nice bag; a new nice leather bag; a nice leather new bag
Q: They live in ___. | *a large old stone house; an old large stone house; a stone large old house; a large stone old house
D: 4

# Multiples: 'twice as … as'
R: Express multiples with 'as … as': twice as big as, three times as fast as. 'Twice more than' and 'double than' are errors.
N: 'Three times larger than' is common and accepted, but 'twice' always takes 'as … as'.
E: His salary is twice as high as mine.
E: This road is three times as long as that one.
X: She earns twice more than her husband. => She earns twice as much as her husband.
W: With 'twice', use 'as much as'.
Q: India's population is about four times ___ that of the USA. | *as large as; larger as; large than; as larger than
Q: He has ___ books as I have. | *twice as many; twice as much; twice more; double more
D: 4

# 'Later/latter', 'farther/further', 'latest/last'
R: 'Later' is about time; 'latter' is the second of two. 'Farther' is physical distance; 'further' means 'more' or 'additional' (and also distance). 'Latest' means most recent; 'last' means final, or the one before this.
N: 'Latter' and 'former' are only for TWO things; for three or more, say 'the last' and 'the first'.
E: Of tea and coffee, I prefer the latter.
E: For further details, contact the branch.
E: Have you read his latest novel?
X: Of the two options, the later is cheaper. => Of the two options, the latter is cheaper.
W: The second of two: 'latter'.
Q: Please wait for ___ instructions. | *further; farther; furthest; farthest
Q: What is the ___ news about the election? | *latest; last; later; latter
D: 4

## Adverbs

# Adverb pairs with different meanings: hard/hardly, late/lately
R: Some adverbs have two forms with different meanings: hard (with effort) / hardly (scarcely); late (not on time) / lately (recently); near (close) / nearly (almost); high (up) / highly (very much); deep (far down) / deeply (very much); most / mostly (mainly).
N: 'Hardly' is a negative word: 'He hardly works' means he does almost no work — the opposite of 'He works hard'.
E: He works hard.
E: I haven't seen him lately.
E: The plane flew high above the clouds.
X: She was high praised for her work. => She was highly praised for her work.
W: 'Highly' means 'very much'.
Q: The train arrived ___ due to fog. | *late; lately; later; latest
Q: I have ___ finished; give me two minutes. | *nearly; near; nearby; nearest
D: 4

# 'Too much' and 'much too'
R: 'Too much' and 'too many' go before a noun (an excessive amount). 'Much too' goes before an adjective or adverb (far too).
N: 'Too much' can also come after a verb: 'He talks too much.'
E: He drinks too much coffee.
E: The box is much too heavy for you.
X: This shirt is too much expensive. => This shirt is much too expensive.
W: Before an adjective, use 'much too'.
Q: The exam was ___ difficult for most students. | *much too; too much; too many; very much
Q: There are ___ people in the queue. | *too many; too much; much too; many too
D: 4
`;
