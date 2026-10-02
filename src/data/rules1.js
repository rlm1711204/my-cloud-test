// Built-in Grammar Rule Book, part 1. Plain-text format, one rule per "# " heading (see src/lib/rulebook.js):
//   ## Topic            starts a topic
//   # Rule title        starts a rule
//   R: the rule         N: note / exception        T: exam tip
//   E: correct example  X: wrong => right          W: why (for the X line above)
//   Q: question with ___ | option; *right option; option; option
// You can add rules here yourself on GitHub — keep the same letters and the app picks them up.
export default `
## Subject–Verb Agreement

# Singular subject, singular verb
R: A singular subject takes a singular verb and a plural subject takes a plural verb. Find the real subject first; ignore words that come between the subject and the verb.
E: The quality of the mangoes was not good.
X: The quality of the mangoes were not good. => The quality of the mangoes was not good.
W: The subject is 'quality' (singular), not 'mangoes'.
T: In error-spotting, cross out the 'of + noun' phrase and check the verb against the word before 'of'.
Q: The list of selected candidates ___ been put up on the notice board. | *has; have; are; were
Q: The cost of all these articles ___ risen. | *has; have; are; were

# Each, every, either, neither take a singular verb
R: 'Each', 'every', 'either', 'neither', 'everyone', 'everybody', 'no one', 'nobody', 'anyone' and 'someone' are singular and take a singular verb and singular pronouns.
E: Each of the boys has brought his book.
E: Every man and every woman was given a ticket.
X: Each of the students have submitted their assignment. => Each of the students has submitted his or her assignment.
W: 'Each' is the subject, so the verb is singular.
T: 'Every' before two nouns joined by 'and' still takes a singular verb.
Q: Neither of the two answers ___ correct. | *is; are; were; have been
Q: Every boy and girl ___ present in the hall. | *was; were; are; have been

# Two subjects joined by 'and'
R: Two subjects joined by 'and' take a plural verb. But if both nouns refer to the same person or thing, or form one idea, the verb is singular.
E: Ram and Shyam are brothers.
E: The secretary and treasurer has been arrested.
E: Bread and butter is his favourite breakfast.
X: The poet and the philosopher is dead. => The poet and the philosopher are dead.
W: 'The' is repeated, so these are two different people: plural verb.
T: One article ('the secretary and treasurer') = one person = singular verb; two articles = two people = plural verb.
Q: Slow and steady ___ the race. | *wins; win; are winning; have won
Q: The collector and the magistrate ___ arrived. | *have; has; is; was

# Either…or, neither…nor: verb agrees with the nearer subject
R: When subjects are joined by 'either…or', 'neither…nor', 'not only…but also' or 'or', the verb agrees with the subject nearer to it.
E: Neither the teacher nor the students were present.
E: Either you or he is to blame.
X: Neither Ram nor his friends was there. => Neither Ram nor his friends were there.
W: 'Friends' is nearer the verb, so the verb is plural.
T: Exams often put the singular subject second: 'Neither the players nor the captain ___' → singular.
Q: Not only the students but also the teacher ___ responsible. | *is; are; were; have been
Q: Either the manager or his assistants ___ the files. | *have; has; is; was

# 'As well as', 'with', 'along with', 'together with', 'besides'
R: When two subjects are joined by 'as well as', 'with', 'along with', 'together with', 'besides', 'in addition to' or 'like', the verb agrees with the FIRST subject.
E: The captain, along with his players, was honoured.
E: He as well as his brothers is coming.
X: The minister, together with his advisers, are expected today. => The minister, together with his advisers, is expected today.
W: 'Together with his advisers' is extra information; the subject is 'the minister'.
T: Put the 'with/as well as' phrase in brackets mentally.
Q: The house, with all its furniture, ___ sold. | *was; were; have been; are
Q: My friends as well as I ___ invited. | *were; was; am; has been

# 'The number of' vs 'a number of'
R: 'A number of' means 'many' and takes a plural verb. 'The number of' refers to the number itself and takes a singular verb.
E: A number of students were absent.
E: The number of students is increasing.
X: The number of accidents are rising. => The number of accidents is rising.
W: The subject is 'the number', a single figure.
Q: A number of books ___ missing from the library. | *are; is; was; has been
Q: The number of applicants this year ___ very high. | *is; are; were; have been

# 'One of the' + plural noun + singular verb
R: 'One of the + plural noun' takes a singular verb, because the subject is 'one'. But in 'one of those who / that…', the relative clause refers to the plural noun and takes a plural verb.
E: One of my friends is a doctor.
E: He is one of those people who never give up.
X: One of the boys were absent. => One of the boys was absent.
W: The subject is 'one'.
Q: One of the windows ___ broken. | *is; are; were; have been
Q: She is one of the best players who ___ ever played for India. | *have; has; was; is

# Collective nouns
R: A collective noun (team, jury, committee, family, crowd) takes a singular verb when the group acts as one unit, and a plural verb when the members act separately or disagree.
E: The jury has given its verdict.
E: The jury were divided in their opinions.
X: The committee have submitted its report. => The committee has submitted its report.
W: The committee acts as one body (and 'its' is singular), so the verb must be singular too.
T: Keep the verb and the pronoun consistent: 'has… its' or 'have… their', never mixed.
Q: The team ___ playing very well this season. | *is; are; were; have
Q: The family ___ quarrelling among themselves. | *are; is; was; has been

# Nouns plural in form but singular in meaning
R: Names of subjects, diseases and some other nouns ending in -s are singular: mathematics, physics, economics (as a subject), news, measles, mumps, innings, politics (as a subject), billiards.
E: Mathematics is my favourite subject.
E: The news is true.
X: The news are very encouraging. => The news is very encouraging.
W: 'News' is always singular.
N: When used for qualities or affairs, some take a plural verb: 'His politics are confusing.' 'The economics of the plan are doubtful.'
Q: Measles ___ an infectious disease. | *is; are; were; have been
Q: No news ___ good news. | *is; are; were; be

# Nouns always plural
R: Some nouns are always plural and take a plural verb: scissors, trousers, spectacles, tongs, riches, thanks, premises, alms, cattle, police, people, clergy, gentry, poultry.
E: The police have arrested the thief.
E: The cattle are grazing in the field.
X: The police has arrested the culprit. => The police have arrested the culprit.
W: 'Police' is always plural.
T: 'A pair of scissors IS…' — with 'a pair of', the verb is singular.
Q: The cattle ___ grazing in the field. | *are; is; was; has been
Q: A pair of scissors ___ on the table. | *is; are; were; have been

# Amounts of money, time, distance and weight
R: An amount of money, a period of time, a distance or a weight thought of as one whole takes a singular verb.
E: Ten thousand rupees is a large sum.
E: Five kilometres is too far to walk.
X: Twenty years are a long time. => Twenty years is a long time.
W: Twenty years is thought of as one period.
Q: Fifty rupees ___ not enough for this book. | *is; are; were; have been
Q: Three hours ___ too short for this paper. | *is; are; were; have been

# 'There is' / 'there are'
R: After 'there', the verb agrees with the noun that follows it.
E: There are many reasons for his failure.
E: There is a pen and two pencils on the desk.
X: There is many problems in this plan. => There are many problems in this plan.
W: The real subject is 'problems' (plural).
Q: There ___ some mistakes in your answer. | *are; is; was; has been
Q: There ___ a box of chocolates on the table. | *is; are; were; have been

# 'Many a' + singular noun + singular verb
R: 'Many a' is followed by a singular noun and a singular verb. 'A great many' is followed by a plural noun and a plural verb.
E: Many a man has fallen into this trap.
E: A great many students have joined the course.
X: Many a soldiers were killed in the war. => Many a soldier was killed in the war.
W: 'Many a' takes a singular noun and a singular verb.
Q: Many a student ___ failed this paper. | *has; have; are; were
Q: A great many people ___ attended the meeting. | *have; has; is; was

# Relative pronoun agrees with its antecedent
R: The verb after 'who', 'which' or 'that' agrees with the noun or pronoun the relative pronoun refers to.
E: It is I who am to blame.
E: He is one of the officers who have been transferred.
X: It is you who is responsible. => It is you who are responsible.
W: 'Who' refers to 'you', so the verb is 'are'.
Q: It is I who ___ at fault. | *am; is; are; was
Q: This is the boy who ___ won the prize. | *has; have; are; were

# Percentage, fractions, 'most', 'all', 'some', 'half'
R: With fractions, percentages and words like 'all', 'most', 'some', 'half', 'none', 'the rest', the verb agrees with the noun after 'of': singular with an uncountable or singular noun, plural with a plural noun.
E: Half of the cake has been eaten.
E: Half of the students have passed.
E: Forty per cent of the land is barren.
X: Most of the milk have gone sour. => Most of the milk has gone sour.
W: 'Milk' is uncountable, so the verb is singular.
Q: Two-thirds of the work ___ done. | *has been; have been; are; were
Q: Some of the books ___ torn. | *are; is; was; has been

## Nouns

# Uncountable nouns have no plural
R: Uncountable nouns are not used with 'a/an' and have no plural form: information, advice, furniture, luggage, baggage, equipment, machinery, scenery, poetry, stationery, hair (all of it), news, knowledge, evidence, work, homework.
E: He gave me some useful advice.
E: All the furniture was sold.
X: She gave me many informations. => She gave me a lot of information.
W: 'Information' is uncountable: no plural and no 'many'.
T: To count them, use 'a piece of': a piece of advice, an item of news, an article of furniture.
Q: He bought new ___ for his office. | *furniture; furnitures; a furniture; furniture's
Q: The ___ of this valley is beautiful. | *scenery; sceneries; scenaries; a scenery

# Nouns with the same singular and plural form
R: Some nouns have the same form in singular and plural: sheep, deer, swine, series, species, aircraft, crossroads, means, headquarters. The verb shows the number.
E: A series of lectures was arranged.
E: Several aircraft were on the runway.
X: He saw three deers in the forest. => He saw three deer in the forest.
W: 'Deer' has no -s plural.
Q: There are many ___ of birds in this sanctuary. | *species; specie; specieses; specy
Q: Two ___ were grazing near the river. | *sheep; sheeps; sheepes; ships

# Numeral + noun used as an adjective stays singular
R: When a number and a noun together describe another noun (with a hyphen), the noun stays singular: a five-year plan, a ten-rupee note, a two-day holiday.
E: He signed a three-year contract.
X: She gave me a hundred-rupees note. => She gave me a hundred-rupee note.
W: Used as an adjective, 'rupee' stays singular.
N: Words like dozen, score, hundred, thousand, million stay singular after a number: 'two dozen eggs', 'five hundred people' — but 'dozens of eggs', 'hundreds of people'.
Q: We went on a ___ trip. | *ten-day; ten-days; ten days'; tens-day
Q: She bought two ___ bananas. | *dozen; dozens; dozens of; dozen of

# 'People' and 'peoples'
R: 'People' (persons) is plural. 'Peoples' means nations or ethnic groups.
E: Many people were waiting outside.
E: The peoples of Asia have many cultures.
X: The people is unhappy with the new rules. => The people are unhappy with the new rules.
W: 'People' meaning persons takes a plural verb.
Q: Many ___ were injured in the accident. | *people; peoples; peoples'; person
Q: The ___ of Europe speak many languages. | *peoples; people; peoples'; peopls

# Possessive case ('s) — mainly for living things
R: The apostrophe-s possessive is used mainly for people and animals. For lifeless things use 'of': the leg of the table, not the table's leg. Exceptions: time, distance, personified things (a day's work, a mile's walk, the sun's rays, the nation's pride).
E: The legs of the table are broken.
E: He took a week's leave.
X: The book's cover is torn. => The cover of the book is torn.
W: 'Book' is lifeless, so 'of' is preferred.
T: When two people own one thing, only the last name takes 's: 'Ram and Shyam's shop'. Separate ownership: 'Ram's and Shyam's shops'.
Q: The station is ___ from here. | *an hour's journey; an hours' journey; an hour journey; a hour's journey
Q: This is ___ (one shop owned by both). | *Ram and Shyam's shop; Ram's and Shyam's shop; Ram's and Shyam shop; Ram and Shyam shop's

# 'Each other' and 'one another'
R: Traditionally, 'each other' is used for two people and 'one another' for more than two. (Modern English often mixes them, but exams follow the traditional rule.)
E: The two brothers love each other.
E: The members of the team helped one another.
X: The five friends talked to each other. => The five friends talked to one another.
W: More than two people: 'one another'.
Q: The husband and wife respect ___. | *each other; one another; themselves; each others
Q: All the students in the class help ___. | *one another; each other; themselves; one other

## Pronouns

# Pronoun after 'than' and 'as'
R: After 'than' or 'as' in a comparison, use the pronoun form the hidden verb needs: 'He is taller than I (am).' 'I like you more than him' means 'more than I like him'.
E: She sings better than I.
E: He is as clever as she.
X: My brother is taller than me. => My brother is taller than I.
W: The full sentence is 'than I am' — subject form 'I'.
T: Finish the sentence in your head to pick the pronoun.
Q: Nobody works harder than ___. | *he; him; his; himself
Q: She is as intelligent as ___. | *he; him; his; himself

# 'Between you and me' — object pronoun after a preposition
R: After a preposition, use the object form of the pronoun: me, him, her, us, them, whom.
E: This is between you and me.
E: The letter was addressed to him and me.
X: Let this remain between you and I. => Let this remain between you and me.
W: 'Between' is a preposition: object form 'me'.
Q: The prize was shared between Rahul and ___. | *me; I; myself; mine
Q: He sent invitations to my wife and ___. | *me; I; myself; mine

# Order of personal pronouns
R: When pronouns come together: second person, then third, then first (2-3-1: 'you, he and I') for good actions. When admitting a fault, the first person comes first (1-2-3: 'I, you and he are to blame').
E: You, he and I will go together.
E: I, you and he are guilty.
X: I, you and he will attend the function. => You, he and I will attend the function.
W: For a neutral or good action, the order is 2-3-1.
Q: ___ have been selected for the team. | *You, he and I; I, you and he; He, I and you; I, he and you
Q: ___ are responsible for this mistake. | *I, you and he; You, he and I; He, you and I; You, I and he

# Reflexive pronouns need the subject
R: Reflexive pronouns (myself, himself, themselves) are used when the object is the same as the subject, or for emphasis. Don't use them in place of 'I' or 'me'.
E: He hurt himself.
E: I myself saw the accident.
X: My friend and myself went to the market. => My friend and I went to the market.
W: 'Myself' cannot be a subject.
N: Some verbs take a reflexive pronoun: absent, avail, enjoy, pride, acquit, revenge. 'He absented himself from the meeting.' 'Avail yourself of this chance.'
Q: She absented ___ from class yesterday. | *herself; her; she; hers
Q: You should avail ___ of this opportunity. | *yourself; you; your; yours

# 'Who' and 'whom'
R: 'Who' is a subject (does the action); 'whom' is an object (receives it, or follows a preposition).
E: The man who came yesterday is my uncle.
E: The man whom you met is my uncle.
X: Whom do you think is the best candidate? => Who do you think is the best candidate?
W: 'Who' is the subject of 'is'; 'do you think' is just inserted.
T: Replace with he/him: if 'he' fits, use who; if 'him' fits, use whom.
Q: To ___ did you give the book? | *whom; who; which; whose
Q: The boy ___ won the race is my cousin. | *who; whom; which; whose

# Pronoun must agree with its noun
R: A pronoun agrees with the noun it stands for in number, gender and person. 'One' is followed by 'one's', not 'his'.
E: One should keep one's promises.
E: Every student must bring his or her own book.
X: One must do his duty. => One must do one's duty.
W: 'One' takes 'one's'.
Q: One should respect ___ parents. | *one's; his; their; your
Q: Each of the girls brought ___ own lunch. | *her; their; his; theirs

# 'Who', 'which', 'that'
R: Use 'who' for people, 'which' for things and animals, and 'that' for both. 'That' is preferred after superlatives, 'all', 'same', 'only', 'any', 'nothing', and after a mix of people and things.
E: This is the best book that I have read.
E: All that glitters is not gold.
E: The man and his dog that were here have left.
X: This is the best film which I have seen. => This is the best film that I have seen.
W: After a superlative, use 'that'.
Q: He is the only person ___ can help us. | *that; which; whom; whose
Q: The car ___ he bought is red. | *which; who; whom; whose

# 'It is I' — subject form after 'be'
R: After forms of 'be' (is, am, are, was, were), formal English uses the subject form of the pronoun: 'It is I', 'It was he'.
E: It was she who called.
X: It was him who broke the glass. => It was he who broke the glass.
W: After 'was', use the subject form 'he'.
Q: If I were ___, I would accept the offer. | *he; him; his; himself
Q: It is ___ who must decide. | *they; them; their; themselves

# Avoid using a pronoun twice for one subject
R: Don't repeat the subject with a pronoun, and don't use 'whom' or 'who' alongside another pronoun for the same noun.
E: The book that I bought is useful.
X: The man whom I met him yesterday is a doctor. => The man whom I met yesterday is a doctor.
W: 'Whom' already stands for 'the man', so 'him' is extra.
Q: Choose the correct sentence. | *The boy whom you saw is my son.; The boy whom you saw him is my son.; The boy who you saw him is my son.; The boy whom you saw he is my son.
Q: Choose the correct sentence. | *My brother is a lawyer.; My brother he is a lawyer.; My brother, he is being a lawyer.; My brother him is a lawyer.

# 'Either' and 'neither' for two; 'any' and 'none' for more
R: 'Either' and 'neither' are used for two people or things. For more than two, use 'any', 'none' or 'no one'.
E: Either of the two roads leads to the station.
E: None of the five answers is correct.
X: Neither of the three boys came. => None of the three boys came.
W: Three is more than two, so 'none'.
Q: ___ of these four pens writes well. | *None; Neither; Either; Both
Q: You may take ___ of the two books. | *either; any; none; all

## Articles

# 'A' or 'an' depends on sound, not spelling
R: Use 'a' before a consonant sound and 'an' before a vowel sound — it's the first SOUND that matters, not the letter.
E: an hour, an honest man, an MLA, an X-ray
E: a university, a European, a one-day match, a useful book
X: He is a honest officer. => He is an honest officer.
W: The 'h' in 'honest' is silent — it starts with a vowel sound.
Q: She is ___ university professor. | *a; an; the; no article
Q: He waited for ___ hour. | *an; a; the; no article

# 'The' before unique things, superlatives and ordinals
R: Use 'the' before things that are one of a kind (the sun, the earth, the sky), superlatives (the best), ordinals (the first), and names of rivers, seas, oceans, mountain ranges, deserts, holy books, newspapers and some countries (the USA, the UK, the Netherlands).
E: The Ganga is a holy river.
E: He is the tallest boy in the class.
X: Himalayas are the highest mountains. => The Himalayas are the highest mountains.
W: Mountain ranges take 'the'.
N: No 'the' before single mountain peaks (Mount Everest), most countries, cities, lakes ('Lake Chilka'), or languages used alone ('He speaks Hindi').
Q: ___ Ramayana is an epic. | *The; A; An; no article
Q: He reads ___ Hindu every day. | *The; A; An; no article

# No article before uncountable and plural nouns in a general sense
R: Don't use an article before uncountable or plural nouns used in a general sense: 'Honesty is the best policy', 'Books are our friends'. Use 'the' only when they are made specific.
E: Gold is a precious metal.
E: The gold in this ring is pure.
X: The honesty is the best policy. => Honesty is the best policy.
W: 'Honesty' is used in a general sense.
Q: ___ man is mortal. | *(no article); The; A; An
Q: ___ water in this well is not fit to drink. | *The; A; An; (no article)

# No article before meals, games, languages and institutions used for their purpose
R: No article before names of meals (breakfast, lunch), games (cricket), languages (English), and school, college, church, hospital, prison, bed when used for their main purpose.
E: He goes to school every day.
E: We had lunch at noon.
E: She went to the school to meet the principal.
X: He was sent to the prison for theft. => He was sent to prison for theft.
W: Sent there for its purpose (punishment): no article.
Q: My father has gone to ___ church to pray. | *(no article); the; a; an
Q: We play ___ cricket in the evening. | *(no article); the; a; an

# Article with 'few' and 'little'
R: 'A few' / 'a little' = some (a positive idea). 'Few' / 'little' = hardly any (a negative idea). 'The few' / 'the little' = all of the small amount there is.
E: I have a few friends here, so I am not lonely.
E: He has little hope of success.
E: He spent the little money he had.
X: Few students attended, so the hall was full. => A few students attended, but the hall was nearly empty.
W: 'Few' means almost none, so it can't fill a hall.
T: 'Few/a few' with countable nouns; 'little/a little' with uncountable nouns.
Q: There is ___ milk left; buy some. | *little; a little; few; a few
Q: I know ___ people in this city, so I can ask for help. | *a few; few; little; a little

# 'The' with adjectives for a whole class
R: 'The + adjective' stands for a whole class of people and takes a plural verb: the rich, the poor, the young, the old, the blind.
E: The rich are not always happy.
X: The poor is often neglected. => The poor are often neglected.
W: 'The poor' means poor people (plural).
Q: The young ___ the future of the country. | *are; is; was; has been
Q: We should help ___ blind. | *the; a; an; (no article)

# Repeating the article
R: When two adjectives describe one person or thing, use the article once. When they describe two different people or things, repeat the article.
E: He has a black and white cow. (one cow, two colours)
E: He has a black and a white cow. (two cows)
X: The Principal and the Manager of the school is my uncle. => The Principal and Manager of the school is my uncle.
W: One person holding both posts: one article, singular verb.
Q: She owns a red and ___ blue car (two cars). | *a; the; (no article); an
Q: ___ editor and publisher of this paper is an honest man (one person). | *The; A; An; (no article)

## Adjectives & Comparison

# Degrees of comparison: than with comparative, 'the' with superlative
R: Use the comparative (-er / more) when comparing two, followed by 'than'. Use the superlative (-est / most) for three or more, with 'the'.
E: He is taller than his brother.
E: He is the tallest boy in the class.
X: He is the taller boy in the class. => He is the tallest boy in the class.
W: A class has more than two boys: superlative.
N: For two things without 'than', 'the + comparative' is used: 'He is the taller of the two.'
Q: Of the two sisters, Meena is ___. | *the cleverer; the cleverest; cleverer; more cleverer
Q: Mount Everest is ___ peak in the world. | *the highest; higher; the higher; most high

# No double comparatives or superlatives
R: Never use 'more' or 'most' with a word that already has -er or -est.
E: She is more intelligent than her sister.
X: This is the most cheapest shop. => This is the cheapest shop.
W: 'Cheapest' is already a superlative.
Q: He is ___ than me. | *stronger; more stronger; most strong; strongest
Q: This is ___ book I have ever read. | *the best; the most best; the most good; best

# Latin comparatives take 'to', not 'than'
R: Adjectives ending in -or (superior, inferior, senior, junior, prior, anterior, posterior, preferable) are followed by 'to', not 'than', and never by 'more'.
E: He is senior to me.
E: Death is preferable to dishonour.
X: This cloth is superior than that. => This cloth is superior to that.
W: 'Superior' takes 'to'.
T: Also 'prefer A to B' — never 'prefer than'.
Q: My brother is junior ___ me in service. | *to; than; from; with
Q: I prefer tea ___ coffee. | *to; than; over than; from

# Absolute adjectives have no degrees
R: Adjectives with an absolute meaning have no comparative or superlative: unique, perfect, ideal, complete, entire, round, square, excellent, extreme, chief, universal, infinite.
E: This painting is unique.
X: This is the most unique idea. => This is a unique idea.
W: 'Unique' means one of a kind — it can't be more or most.
Q: His plan was ___. | *perfect; more perfect; most perfect; perfectest
Q: Her answer was ___. | *excellent; more excellent; most excellent; excellenter

# Comparing like with like
R: Compare things of the same kind. Use 'that of' / 'those of' to avoid comparing a thing with a person.
E: The climate of Shimla is better than that of Delhi.
X: The population of Mumbai is greater than Delhi. => The population of Mumbai is greater than that of Delhi.
W: Compare population with population, not with a city.
Q: The salary of a doctor is higher than ___ a teacher. | *that of; those of; of; than
Q: The roads of Chandigarh are wider than ___ Delhi. | *those of; that of; of; than

# 'Other' or 'else' when comparing within a group
R: When a comparative compares one member with the rest of its own group, add 'other' or 'else' so it isn't compared with itself.
E: He is taller than any other boy in the class.
E: Rama is wiser than anyone else here.
X: Delhi is bigger than any city in India. => Delhi is bigger than any other city in India.
W: Delhi is itself a city in India, so 'other' is needed.
Q: Gold is more precious than any ___ metal. | *other; another; (nothing); more
Q: She is cleverer than anyone ___ in her family. | *else; other; another; more

# 'Elder/eldest' and 'older/oldest'
R: 'Elder' and 'eldest' are for members of the same family and are not followed by 'than'. 'Older' and 'oldest' are for people and things in general and can take 'than'.
E: My elder brother is a doctor.
E: He is older than me.
X: He is elder than his sister. => He is older than his sister.
W: 'Elder' cannot be followed by 'than'.
Q: My ___ sister lives in Delhi. | *elder; older; oldest; more old
Q: This building is ___ than that one. | *older; elder; eldest; more elder

# 'Less' and 'fewer'
R: 'Fewer' is used with countable nouns (fewer books); 'less' with uncountable nouns (less sugar).
E: There were fewer accidents this year.
E: Use less salt.
X: There are less students in the class today. => There are fewer students in the class today.
W: 'Students' are countable.
Q: He made ___ mistakes than last time. | *fewer; less; lesser; little
Q: I have ___ time than you. | *less; fewer; lesser; few
`;
