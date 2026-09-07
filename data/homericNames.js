/**
 * homericNames.js
 * Curated glosses for Homeric proper names — people, places, and epithets
 * that LSJ's headword-per-common-word structure does not reach well: it
 * carries almost no proper nouns, and where it does, an automatic match is
 * too likely to land on an unrelated homonym (Δανάη the girl vs. LSJ's
 * entry for Δανάη, `= δάφνη` — the plant).
 *
 * This is authored content, not a download, so unlike data/sources/ it is
 * committed to the repo. buildHomerIndex.js applies it last, filling only
 * lemmas that still have no gloss after majorplus, LSJ, and LSJ
 * cross-references have all had a turn.
 *
 * Covers the ~150 most frequent still-unglossed Homeric names by token
 * count, plus a handful of spelling/casing variants of names on that list.
 * Names left out (Ξάνθος, Πόλυβος, Πείσανδρος, Ἄντιφος, Πήδασος, Ἐφύρα,
 * Λαοδάμας, and others further down the frequency list) have more than one
 * plausible Homeric bearer with no way to tell which is meant from the
 * lemma alone — better to leave them unglossed than guess.
 *
 * Author: Tyler Peairs
 */
export const HOMERIC_NAMES = {
  // By frequency, most-attested first.
  "Ἕκτωρ": "Hector, son of Priam", // 442
  "Ἀθήνη": "Athena", // 310
  "Τηλέμαχος": "Telemachus, son of Odysseus", // 244
  "Ἀτρείδης": "son of Atreus, i.e. Agamemnon or Menelaus", // 209
  "Ἄρης": "Ares, god of war", // 163
  "Δαναοί": "the Danaans, i.e. the Greeks", // 154
  "Πρίαμος": "Priam, king of Troy", // 150
  "Πάτροκλος": "Patroclus, companion of Achilles", // 145
  "Ποσειδεών": "Poseidon, god of the sea", // 79
  "Αἰνείας": "Aeneas, Trojan hero, son of Anchises", // 78
  "Ἰδομενεύς": "Idomeneus, king of Crete, leader of the Cretans", // 77
  "Φαίαξ": "a Phaeacian", // 75
  "Κρονίων": "son of Cronus, i.e. Zeus", // 73
  "Ἀλκίνοος": "Alcinous, king of the Phaeacians", // 70
  "Τυδείδης": "son of Tydeus, i.e. Diomedes", // 62
  "Ἀντίλοχος": "Antilochus, son of Nestor", // 61
  "Ἑλένη": "Helen, wife of Menelaus", // 59
  "Μηριόνης": "Meriones, companion of Idomeneus", // 57
  "Ἀντίνοος": "Antinous, a suitor of Penelope", // 56
  "Πηλείδης": "son of Peleus, i.e. Achilles", // 55
  "Φοῖβος": "Phoebus, epithet of Apollo", // 52
  "Ἄργος": "Argos", // 48
  "Λύκιοι": "the Lycians", // 44
  "ᾍδης": "Hades, god of the underworld", // 43
  "Μυρμιδόνες": "the Myrmidons, Achilles' people", // 42
  "Θέτις": "Thetis, mother of Achilles", // 41
  "Τυδεύς": "Tydeus, father of Diomedes", // 41
  "Ἶρις": "Iris, messenger of the gods", // 40
  "Εὔμαιος": "Eumaeus, Odysseus' swineherd", // 40
  "Λαερτιάδης": "son of Laertes, i.e. Odysseus", // 38
  "Πύλος": "Pylos, kingdom of Nestor", // 37
  "Ἴδη": "Mount Ida, near Troy", // 35
  "Πριαμίδης": "son of Priam", // 33
  "Πουλυδάμας": "Poulydamas, a Trojan counselor", // 30
  "Λαέρτης": "Laertes, father of Odysseus", // 30
  "Εὐρύμαχος": "Eurymachus, a suitor of Penelope", // 30
  "Πηλείων": "son of Peleus, i.e. Achilles", // 29
  "Τελαμών": "Telamon, father of Ajax", // 29
  "Τεῦκρος": "Teucer, archer, half-brother of Ajax", // 28
  "Ἀργειφόντης": "epithet of Hermes, slayer of Argus", // 27
  "Αἰακίδης": "descendant of Aeacus, epithet of Achilles", // 26
  "Βορέας": "the North Wind", // 25
  "Ἰδαῖος": "Idaeus, herald of Priam", // 24
  "Εὐρύκλεια": "Eurycleia, Odysseus' nurse", // 24
  "Αὐτομέδων": "Automedon, charioteer of Achilles", // 23
  "Ἐπειός": "Epeius, builder of the Trojan Horse", // 22
  "Διοτρεφής": "fostered by Zeus, an epithet of kings", // 21
  "Εὐρύπυλος": "Eurypylus, a Greek leader", // 21
  "Γλαῦκος": "Glaucus, Lycian ally of Troy", // 21
  "Μενοιτιάδης": "son of Menoetius, i.e. Patroclus", // 20
  "Ζέφυρος": "the West Wind", // 20
  "Ἀχαιίς": "the Achaean land, i.e. Greece", // 20
  "Μέντωρ": "Mentor, friend of Odysseus", // 20
  "Φοῖνιξ": "Phoenix, tutor of Achilles", // 20
  "Αἴγισθος": "Aegisthus, lover of Clytemnestra, killer of Agamemnon", // 20
  "Μενοίτιος": "Menoetius, father of Patroclus", // 19
  "Λυκάων": "Lycaon, son of Priam", // 19
  "Δηίφοβος": "Deiphobus, son of Priam", // 18
  "Τρωιός": "Trojan", // 18
  "Αὐτόλυκος": "Autolycus, grandfather of Odysseus", // 17
  "Ἀτρεύς": "Atreus, father of Agamemnon and Menelaus", // 17
  "Ἀντήνωρ": "Antenor, a Trojan elder", // 17
  "Θρᾷξ": "a Thracian", // 15
  "Μέδων": "Medon, name of a Greek herald and a warrior", // 15
  "Νεστορίδης": "son of Nestor", // 15
  "Τειρεσίης": "Tiresias, blind prophet of Thebes", // 15
  "Πύλιος": "a Pylian, of Pylos", // 14
  "Νότος": "the South Wind", // 14
  "Θόας": "Thoas, leader of the Aetolians", // 14
  "Αἰτωλός": "an Aetolian", // 14
  "Ὀιλεύς": "Oileus, father of the lesser Ajax", // 14
  "Εὐπείθης": "Eupeithes, father of Antinous", // 14
  "Εὐρύλοχος": "Eurylochus, companion of Odysseus", // 14
  "Ἠετίων": "Eetion, father of Andromache", // 13
  "Ἀγήνωρ": "Agenor, a Trojan warrior", // 13
  "Κεβριόνης": "Cebriones, charioteer of Hector, son of Priam", // 13
  "Ἄσιος": "Asius, a Trojan ally, son of Hyrtacus", // 13
  "Τελαμώνιος": "son of Telamon, i.e. Ajax", // 13
  "Εὐρυνόμη": "Eurynome, Penelope's housekeeper", // 13
  "Περσεφόνεια": "Persephone, queen of the underworld", // 13
  "Ἀρήτη": "Arete, queen of the Phaeacians", // 13
  "Παναχαιοί": "the Panachaeans, all the Achaeans", // 12
  "Τελαμωνιάδης": "son of Telamon, i.e. Ajax", // 12
  "Ἀΐδης": "Hades, god of the underworld", // 12
  "Δαρδανίδης": "descendant of Dardanus", // 12
  "Σκαιαί": "the Scaean Gate of Troy", // 12
  "Ἀγχίσης": "Anchises, father of Aeneas", // 12
  "Ἀίδης": "Hades, god of the underworld", // 12
  "Ἐρινύς": "an Erinys, a Fury", // 12
  "Μελάνθιος": "Melanthius, disloyal goatherd of Odysseus", // 12
  "Ἀμφίνομος": "Amphinomus, a suitor of Penelope", // 12
  "Ἶρος": "Irus, a beggar in Ithaca", // 12
  "Οὐρανίωνες": "the heavenly gods, descendants of Uranus", // 11
  "Μαχάων": "Machaon, a Greek healer", // 11
  "Πάρις": "Paris, Trojan prince who abducted Helen", // 11
  "Ὀρέστης": "Orestes, son of Agamemnon", // 11
  "Αἶσα": "Fate, destiny personified", // 11
  "Ἰθακήσιος": "an Ithacan", // 11
  "Ναυσικάα": "Nausicaa, Phaeacian princess", // 11
  "Βρισηίς": "Briseis, captive woman of Achilles", // 10
  "Θήβη": "Thebe, a city in Mysia, home of Andromache's father", // 10
  "Θρασυμήδης": "Thrasymedes, son of Nestor", // 10
  "Ἀκάμας": "Acamas, a Trojan ally", // 10
  "Ἱππόλοχος": "Hippolochus, father of Glaucus", // 10
  "Ἦλις": "Elis, a region in the Peloponnese", // 10
  "Ἕλενος": "Helenus, son of Priam, a seer", // 10
  "Τληπόλεμος": "Tlepolemus, leader of the Rhodians", // 10
  "Τρῳάς": "Trojan (fem.); the Troad", // 10
  "Σθένελος": "Sthenelus, companion of Diomedes", // 10
  "Λαομέδων": "Laomedon, earlier king of Troy, father of Priam", // 10
  "Αἴγυπτος": "Egypt (also the river Nile)", // 10
  "Πεισίστρατος": "Peisistratus, son of Nestor", // 10
  "Πειρίθοος": "Pirithous, king of the Lapiths", // 9
  "Ταλθύβιος": "Talthybius, herald of Agamemnon", // 9
  "Ἀστεροπαῖος": "Asteropaeus, Trojan ally, grandson of the river Axius", // 9
  "Ἐνυάλιος": "Enyalius, epithet of Ares, god of war", // 9
  "Κίκονες": "the Cicones, a Thracian people", // 9
  "Φθία": "Phthia, homeland of Achilles", // 9
  "Εὐρύαλος": "Euryalus", // 9
  "Εὔμηλος": "Eumelus, a Greek leader, son of Admetus", // 9
  "Χάρυβδις": "Charybdis, a whirlpool monster", // 9
  "Δημόδοκος": "Demodocus, bard of the Phaeacians", // 9
  "Θεσπρωτοί": "the Thesprotians, a people of Epirus", // 9
  "Δολίος": "Dolius, a servant of Penelope and Laertes", // 9
  "Καδμεῖος": "Cadmean, i.e. Theban", // 8
  "Ἀγέλαος": "Agelaus, a suitor of Penelope", // 8
  "Σιμόεις": "the Simois, a river near Troy", // 8
  "Πηνέλεως": "Peneleos, a Boeotian leader", // 8
  "Πανθοίδης": "son of Panthous", // 8
  "Οἰνεύς": "Oeneus, king of Calydon, grandfather of Diomedes", // 8
  "Ἡρακλέης": "Heracles", // 8
  "Χάρις": "Charis, wife of Hephaestus", // 8
  "Ἑκάβη": "Hecuba, wife of Priam", // 8
  "Ἀθῆναι": "Athens", // 8
  "Πάνδαρος": "Pandarus, Trojan archer", // 8
  "Θεοκλύμενος": "Theoclymenus, a seer in the Odyssey", // 8
  "Πείραιος": "Peiraeus, companion of Telemachus", // 8
  "Κάλχας": "Calchas, Greek seer", // 7
  "Ἀτρυτώνη": "Atrytone, epithet of Athena", // 7
  "Δόλων": "Dolon, Trojan spy", // 7
  "Ἶλος": "Ilus, legendary founder of Troy", // 7
  "Ἀντηνορίδης": "son of Antenor", // 7
  "Ἀλφειός": "the Alpheius, a river in the Peloponnese", // 7
  "Πυλόνδε": "to Pylos", // 7
  "Πολυποίτης": "Polypoites, a Greek leader, son of Pirithous", // 7
  "Μενεσθεύς": "Menestheus, an Athenian leader", // 7
  "Ἀχαιικός": "Achaean", // 7
  "Ἀσκάλαφος": "Ascalaphus, son of Ares, a Greek leader", // 7
  "Βοιωτός": "Boeotian", // 7
  "Φυλείδης": "son of Phyleus, i.e. Meges", // 7
  "Μέγης": "Meges, leader of the Epeans", // 7
  "Μελάνιππος": "Melanippus, a Trojan warrior", // 7
  "Ἱππόθοος": "Hippothous, a Trojan ally", // 7

  // Spelling/casing variants of names above, and a few minor ones.
  "Ἀνδρομάχη": "Andromache, wife of Hector",
  "Ἀσκληπιάδης": "son of Asclepius, i.e. Machaon or Podalirius",
  "Δουλιχιόν": "Dulichium, an island near Ithaca",
  "Σάμη": "Same, an island near Ithaca",
  "πάτροκλος": "Patroclus, companion of Achilles",
  "̓ἀθήνη": "Athena",
  "αἰνείας": "Aeneas, Trojan hero, son of Anchises",
  "̓ἰδομενεύς": "Idomeneus, king of Crete, leader of the Cretans",
  "̓ἀτρείδης": "son of Atreus, i.e. Agamemnon or Menelaus",
  "πύλος": "Pylos, kingdom of Nestor",
  "εὔμαιος": "Eumaeus, Odysseus' swineherd",
  "δημόδοκος": "Demodocus, bard of the Phaeacians",
  "τεῦκρος": "Teucer, archer, half-brother of Ajax",
  "θέτις": "Thetis, mother of Achilles",
  "̓ἀντίλοχος": "Antilochus, son of Nestor",
  "̓ἰδαῖος": "Idaeus, herald of Priam",
  "̓ἀγχίσης": "Anchises, father of Aeneas",
  "σθένελος": "Sthenelus, companion of Diomedes",
  "θρᾷξ": "a Thracian",
  "̓ἀνδρομάχη": "Andromache, wife of Hector",
  "θήβη": "Thebe, a city in Mysia, home of Andromache's father",
  "τρῳάς": "Trojan (fem.); the Troad",
  "τειρεσίης": "Tiresias, blind prophet of Thebes",
  "πυλόνδε": "to Pylos",
  "νεστορίδης": "son of Nestor",
  "εὐρύκλεια": "Eurycleia, Odysseus' nurse",
  "τροίανδε": "to Troy",
  "μελάνθιος": "Melanthius, disloyal goatherd of Odysseus",
  "̓ἀλκίνοος": "Alcinous, king of the Phaeacians",
  "̓ἀρήτη": "Arete, queen of the Phaeacians",
};
