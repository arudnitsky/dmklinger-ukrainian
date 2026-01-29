"use strict";

/**
 * MAIN RENDERING FUNCTION
 *
 * This is the primary rendering function that displays Ukrainian dictionary entries on the page.
 * It uses D3.js for data binding and DOM manipulation to create word cards with definitions
 * and grammatical forms (declension/conjugation tables).
 *
 * @param {Array} data - Array of word objects to display. Each object contains:
 *   - index: Unique identifier for the word entry
 *   - word: The Ukrainian word (may contain stress markers U+0301)
 *   - pos: Part of speech (noun, verb, adjective, etc.)
 *   - info: Additional grammatical info (gender, aspect, etc.)
 *   - defs: Array of English definitions
 *   - forms: Object containing grammatical forms (declensions/conjugations)
 *
 * @param {boolean} increase - If true, appends to existing display (for infinite scroll).
 *                             If false/undefined, clears and renders from scratch (scrolls to top).
 *
 * @returns {void}
 *
 * Implementation Notes:
 * - Uses D3 data binding with 'index' as the key function for efficient updates
 * - Creates two-column layout: left column for definitions, right column for forms
 * - Automatically detects form type based on presence of specific keys (see form detection logic)
 * - Applies search highlighting to words, definitions, and forms after rendering
 * - Does NOT paginate server-side; all filtering happens client-side on pre-loaded data
 */
var main = (data, increase) => {
  // D3 data binding: bind word data to .row divs, keyed by index for efficient updates
  let tr = d3
    .select(".main")
    .selectAll(".row")
    .data(data, (d) => {
      return d.index;
    })
    .join("div");
  tr.attr("class", "row");

  /**
   * HELPER: Get Form
   *
   * Safely retrieves a grammatical form from a forms object.
   * Forms are stored as arrays to handle multiple valid variants (e.g., ["кота", "кòта"]).
   *
   * @param {Object} o - Forms object (e.g., d.forms)
   * @param {string} form - Form key (e.g., 'nom ns', 'acc af', 'inf')
   * @returns {Array} Array of form strings, or ['—'] if form doesn't exist
   */
  let gf = (o, form) => {
    if (form in o) {
      return o[form];
    }
    return ["—"];
  }; // get form

  /**
   * SINGLE NOUN TABLE RENDERER
   *
   * Renders declension table for indeclinable nouns or nouns with only one number form.
   * These nouns use form keys without number suffixes: 'nom n', 'acc n', etc.
   *
   * Examples: proper nouns, borrowed words, mass nouns
   *
   * @param {Object} obj - D3 selection (the parent div to append table to)
   * @param {Object} d - Forms object containing case forms
   *
   * Table Structure:
   * Case Label | Form(s)
   * -----------|--------
   * Nom.       | форма
   * Acc.       | форму
   * ... (all 7 Ukrainian cases)
   *
   * Implementation Notes:
   * - Each form is an array (may contain multiple variants)
   * - Each variant renders as separate <p> element within the cell
   * - Uses gf() to safely retrieve forms, showing '—' for missing cases
   */
  let single_noun_table = (obj, d) => {
    // Structure: [Case Label, Forms Array]
    // 7 Ukrainian cases: Nominative, Accusative, Genitive, Dative, Instrumental, Locative, Vocative
    const word_data = [
      ["Nom.", gf(d, "nom n")],
      ["Acc.", gf(d, "acc n")],
      ["Gen.", gf(d, "gen n")],
      ["Dat.", gf(d, "dat n")],
      ["Ins.", gf(d, "ins n")],
      ["Loc.", gf(d, "loc n")],
      ["Voc.", gf(d, "voc n")],
    ];
    const table = obj.append("table");
    // Iterate through each case, creating a row with case label and form(s)
    for (let i = 0; i < word_data.length; i++) {
      const row = word_data[i];
      const this_row = table.append("tr");
      // Left cell: case label (e.g., "Nom.", "Acc.")
      this_row.append("th").attr("id", "leftLabel").text(row[0]);
      // Right cell: form variants (each variant as separate <p>)
      this_row
        .append("td")
        .selectAll("p")
        .data(row[1]) // row[1] is an array of form variants
        .join("p")
        .text((d) => {
          return d;
        });
    }
  };

  /**
   * REGULAR NOUN TABLE RENDERER
   *
   * Renders full declension table for regular Ukrainian nouns with distinct singular/plural forms.
   * Uses form keys with number suffixes: 'nom ns' (nominative singular), 'nom np' (nominative plural).
   *
   * @param {Object} obj - D3 selection (the parent div to append table to)
   * @param {Object} d - Forms object containing case forms
   *
   * Table Structure:
   *        | Sing.  | Plur.
   * -------|--------|-------
   * Nom.   | кіт    | коти
   * Acc.   | кота   | котів
   * ... (all 7 Ukrainian cases)
   *
   * Implementation Notes:
   * - Header row with column labels for singular and plural
   * - Each cell can contain multiple form variants (rendered as separate <p> tags)
   * - Uses nested D3 data binding: row data -> cells -> form variants
   * - Missing forms display as '—'
   */
  let noun_table = (obj, d) => {
    // Structure: [Case Label, Singular Forms Array, Plural Forms Array]
    // 7 Ukrainian cases × 2 numbers = 14 form slots
    const word_data = [
      ["Nom.", gf(d, "nom ns"), gf(d, "nom np")],
      ["Acc.", gf(d, "acc ns"), gf(d, "acc np")],
      ["Gen.", gf(d, "gen ns"), gf(d, "gen np")],
      ["Dat.", gf(d, "dat ns"), gf(d, "dat np")],
      ["Ins.", gf(d, "ins ns"), gf(d, "ins np")],
      ["Loc.", gf(d, "loc ns"), gf(d, "loc np")],
      ["Voc.", gf(d, "voc ns"), gf(d, "voc np")],
    ];
    const table = obj.append("table");
    // Header row: empty top-left, then "Sing." and "Plur." columns
    const header_row = table.append("tr"); // header row
    header_row.append("th").attr("id", "leftLabel"); // Empty top-left cell
    header_row.append("th").text("Sing."); // Singular column header
    header_row.append("th").text("Plur."); // Plural column header
    // Iterate through each case, creating rows with case label + singular + plural forms
    for (let i = 0; i < word_data.length; i++) {
      const row = word_data[i];
      const this_row = table.append("tr");
      // First cell: case label
      this_row.append("th").attr("id", "leftLabel").text(row[0]);
      // Remaining cells: bind to row.slice(1) which is [singular_forms, plural_forms]
      // Then for each cell, bind to the forms array and create <p> for each variant
      this_row
        .selectAll("td")
        .data(row.slice(1)) // [singular_forms_array, plural_forms_array]
        .join("td")
        .selectAll("p")
        .data((d) => {
          return d;
        }) // d is a forms array, bind to each variant
        .join("p")
        .text((d) => {
          return d;
        }); // d is now a single form string
    }
  };

  /**
   * ADJECTIVE TABLE RENDERER
   *
   * Renders declension table for Ukrainian adjectives with 4 genders (masculine, neuter, feminine, plural).
   * Uses form keys with gender suffixes: 'nom am' (male), 'nom an' (neuter), 'nom af' (female), 'nom ap' (plural).
   *
   * @param {Object} obj - D3 selection (the parent div to append table to)
   * @param {Object} d - Forms object containing case forms and optional additional forms
   *
   * Table Structure:
   *            | Male    | Neut.   | Fem.    | Plur.
   * -----------|---------|---------|---------|-------
   * Nom.       | великий | велике  | велика  | великі
   * Anim. Acc. | [genitive for animate objects]
   * Inan. Acc. | [nominative for inanimate objects]
   * Gen.       | ...
   * ... (all 7 cases)
   *
   * Additional Forms (optional, in d.addl):
   * - comp: Comparative (більший)
   * - super: Superlative (найбільший)
   * - arg: Argotic/colloquial forms
   * - adv: Adverbial forms (велико)
   *
   * Implementation Notes:
   * - Accusative case has two rows: animate (uses genitive) and inanimate (uses nominative)
   * - Additional forms span all 4 columns and display below main declension
   * - Each cell supports multiple variants as separate <p> elements
   */
  let adjective_table = (obj, d) => {
    // Structure: [Case Label, Male Forms, Neuter Forms, Female Forms, Plural Forms]
    // Ukrainian adjectives decline by gender (m/n/f) in singular, and have separate plural forms
    // Accusative case has animacy distinction: animate uses genitive, inanimate uses nominative
    const word_data = [
      [
        "Nom.",
        gf(d, "nom am"),
        gf(d, "nom an"),
        gf(d, "nom af"),
        gf(d, "nom ap"),
      ],
      [
        "Anim. Acc.",
        gf(d, "gen am"),
        gf(d, "nom an"),
        gf(d, "acc af"),
        gf(d, "gen ap"),
      ], // Animate: use genitive
      [
        "Inan. Acc.",
        gf(d, "nom am"),
        gf(d, "nom an"),
        gf(d, "acc af"),
        gf(d, "nom ap"),
      ], // Inanimate: use nominative
      [
        "Gen.",
        gf(d, "gen am"),
        gf(d, "gen an"),
        gf(d, "gen af"),
        gf(d, "gen ap"),
      ],
      [
        "Dat.",
        gf(d, "dat am"),
        gf(d, "dat an"),
        gf(d, "dat af"),
        gf(d, "dat ap"),
      ],
      [
        "Ins.",
        gf(d, "ins am"),
        gf(d, "ins an"),
        gf(d, "ins af"),
        gf(d, "ins ap"),
      ],
      [
        "Loc.",
        gf(d, "loc am"),
        gf(d, "loc an"),
        gf(d, "loc af"),
        gf(d, "loc ap"),
      ],
    ];

    const table = obj.append("table");
    // Header row: empty top-left, then 4 gender columns
    const header_row = table.append("tr"); // header row
    header_row.append("th").attr("id", "leftLabel");
    header_row.append("th").text("Male");
    header_row.append("th").text("Neut.");
    header_row.append("th").text("Fem.");
    header_row.append("th").text("Plur.");
    for (let i = 0; i < word_data.length; i++) {
      const row = word_data[i];
      const this_row = table.append("tr");
      this_row.append("th").attr("id", "leftLabel").text(row[0]);
      this_row
        .selectAll("td")
        .data(row.slice(1))
        .join("td")
        .selectAll("p")
        .data((d) => {
          return d;
        })
        .join("p")
        .text((d) => {
          return d;
        });
    }

    if ("addl" in d) {
      // Possible additional forms: comp, super, arg, adv
      // Only include those that actually exist in the data
      let addls = [];
      for (const addl of ["comp", "super", "arg", "adv"]) {
        if (addl in d["addl"]) {
          addls.push(addl);
        }
      }

      // Render each additional form type as a full-width row
      for (const addl of addls) {
        const addl_tr = table.append("tr");
        addl_tr.append("th").attr("id", "leftLabel").text(
          {
            comp: "Comp.", // Comparative (більший)
            super: "Super.", // Superlative (найбільший)
            arg: "Arg.", // Argotic/colloquial
            adv: "Adv.", // Adverbial (велико)
          }[addl],
        );
        // Single cell spanning all 4 gender columns
        addl_tr
          .append("td")
          .attr("colspan", 4)
          .selectAll()
          .data(gf(d["addl"], addl)) // Get forms array for this additional type
          .join("p")
          .text((d) => {
            return d;
          });
      }
    }
  };

  /**
   * VERB TABLE RENDERER
   *
   * Renders conjugation table for Ukrainian verbs with multiple tenses.
   * Handles complex nested structure with tenses, persons, numbers, and participles.
   *
   * @param {Object} obj - D3 selection (the parent div to append table to)
   * @param {Object} d - Forms object containing verb conjugations
   *
   * Form Structure:
   * {
   *   inf: [...],  // Infinitive forms
   *   past: {      // Past tense (by gender, not person)
   *     ms: [...], ns: [...], fs: [...],  // Singular: male/neuter/female
   *     p: [...]                          // Plural (no gender distinction)
   *   },
   *   pres: {      // Present tense (by person and number)
   *     1s: [...], 2s: [...], 3s: [...],  // 1st/2nd/3rd person singular
   *     1p: [...], 2p: [...], 3p: [...],  // 1st/2nd/3rd person plural
   *     pp: {act: [...], pas: [...], adv: [...], imp: [...]}  // Participles (optional)
   *   },
   *   fut: {...},  // Future tense (same structure as pres)
   *   imp: {       // Imperative (only 1st and 2nd person)
   *     1s: [...], 2s: [...],
   *     1p: [...], 2p: [...]
   *   }
   * }
   *
   * Participle Types (pp):
   * - act: Active participle (читаючий)
   * - pas: Passive participle (читаний)
   * - adv: Adverbial participle (читаючи)
   * - imp: Impersonal participle
   *
   * Implementation Notes:
   * - Past tense organized by gender (m/n/f/p), not person
   * - Present/Future organized by person (1/2/3) and number (s/p)
   * - Imperative only has 1st and 2nd person (no 3rd person commands)
   * - Participles span full table width when present
   * - Each tense section has its own header row
   */
  let verb_table = (obj, d) => {
    // Determine which tenses are present in the data
    // Not all verbs have all tenses (e.g., perfective verbs lack present tense)
    let tenses = [];
    for (const tense of ["past", "pres", "fut", "imp"]) {
      if (tense in d) {
        tenses.push(tense);
      }
    }
    const table = obj.append("table");

    // Infinitive row (always present, spans full table width)
    const inf_tr = table.append("tr");
    inf_tr.append("th").attr("id", "leftLabel").text("Inf.");
    inf_tr
      .append("td")
      .attr("colspan", 6)
      .selectAll()
      .data(gf(d, "inf"))
      .join("p")
      .text((d) => {
        return d;
      });

    for (const tense of tenses) {
      // Map tense key to display label
      const tense_label = {
        past: "Past", // Past tense
        pres: "Pres.", // Present tense
        fut: "Fut.", // Future tense
        imp: "Imp.", // Imperative mood
      }[tense];

      // Determine column categories based on tense:
      // - Past: organized by gender (male/neuter/female)
      // - Imperative: only 1st and 2nd person
      // - Present/Future: 1st, 2nd, and 3rd person
      const tense_categories =
        tense === "past"
          ? ["m", "n", "f"] // Genders for past tense
          : tense === "imp"
            ? ["1", "2"] // Only 1st/2nd person for imperative
            : ["1", "2", "3"]; // 1st/2nd/3rd person for pres/fut

      // Column width adjustment: imperative has 2 categories, so each gets colspan=3
      // Other tenses have 3 categories, so each gets colspan=2
      const tense_label_width = tense === "imp" ? 3 : 2;

      // Tense header row (e.g., "Past | Male | Neuter | Female")
      const tense_label_tr = table.append("tr");
      tense_label_tr.append("th").attr("id", "tenseMarker").text(tense_label);
      tense_label_tr
        .selectAll()
        .data(tense_categories)
        .join("th")
        .attr("colspan", tense_label_width)
        .attr("id", "tenseHeader")
        .text((d) => {
          return {
            m: "Male",
            n: "Neuter",
            f: "Fem.",
            1: "1st",
            2: "2nd",
            3: "3rd",
          }[d];
        });
      for (const number of ["s", "p"]) {
        const number_label_tr = table.append("tr");
        const number_label = number === "s" ? "Sing." : "Plur.";
        number_label_tr.append("th").attr("id", "leftLabel").text(number_label); // "Sing." or "Plur."

        // Special case: past tense plural has no gender distinction
        // All genders collapse into single 'p' form
        if (tense === "past" && number === "p") {
          number_label_tr
            .append("td")
            .attr("colspan", 6) // Span entire table width
            .selectAll()
            .data(gf(d["past"], "p")) // Get 'p' form directly
            .join("p")
            .text((d) => {
              return d;
            });
        }
        // Normal case: create cells for each category (gender or person)
        else {
          number_label_tr
            .selectAll()
            .data(tense_categories) // e.g., ['m','n','f'] or ['1','2','3']
            .join("td")
            .attr("colspan", tense_label_width)
            .selectAll()
            .data((tc) => {
              // Construct form key: category + number (e.g., 'ms', '1p')
              const form = `${tc}${number}`;
              return gf(d[tense], form); // Get forms array for this person/gender+number
            })
            .join("p")
            .text((d) => {
              return d;
            });
        }
      }

      // Participles (optional, stored in d[tense].pp)
      // Types: act (active), pas (passive), adv (adverbial), imp (impersonal)
      if ("pp" in d[tense]) {
        // Check which participle types exist for this tense
        let pps = [];
        for (const pp of ["act", "pas", "adv", "imp"]) {
          if (pp in d[tense]["pp"]) {
            pps.push(pp);
          }
        }

        for (const pp of pps) {
          const participle_tr = table.append("tr");
          participle_tr.append("th").attr("id", "leftLabel").text(
            {
              act: "Act. Part.",
              pas: "Pass. Part.",
              adv: "Adv. Part.",
              imp: "Imp. Part.",
            }[pp],
          );
          participle_tr
            .append("td")
            .attr("colspan", 6)
            .attr("id", "ppLabel")
            .selectAll()
            .data(gf(d[tense]["pp"], pp))
            .join("p")
            .text((d) => {
              return d;
            });
        }
      }
    }
  };

  /**
   * TWO-COLUMN LAYOUT RENDERING
   *
   * Creates a two-column layout for each word entry:
   * - Column 0 (left): Word, POS, grammatical info, and definitions
   * - Column 1 (right): Declension/conjugation table (if forms exist)
   *
   * Uses D3 data binding to create two divs per word entry, one for each column.
   */
  const div = tr
    .selectAll("div")
    .data((d) => {
      // Bind two data items per word: [word_metadata, forms_object]
      return [
        d, // Full word object (for definitions column)
        d.forms, // Forms object (for grammatical forms column)
      ];
    })
    .enter()
    .append("div");
  div.attr("class", "col"); // Both columns get 'col' class for CSS styling
  div.exit().remove();

  // Render each column based on its index (i=0: definitions, i=1: forms)
  div.each(function (d, i) {
    let this_obj = d3.select(this).attr("id", "def");

    // Column 0: Definitions and metadata
    if (i === 0) {
      // Word headword (bolded)
      this_obj.append("p").attr("class", "title").append("b").text(d.word); // Ukrainian word (may contain stress markers)

      // Part of speech and grammatical info
      // e.g., "(noun - masculine)" or "(verb - perfective)"
      this_obj
        .append("p")
        .attr("class", "title")
        .text(d.info ? ` (${d.pos} - ${d.info})` : ` (${d.pos})`);

      // Definitions list (English translations)
      this_obj
        .append("div")
        .append("ul")
        .selectAll()
        .data(d.defs) // Array of definition strings
        .join("li")
        .text((d) => {
          return d;
        });
    }
    // Column 1: Grammatical forms table
    else if (i === 1) {
      this_obj.attr("id", "forms");
      if ("nom n" in d || "acc n" in d) {
        single_noun_table(this_obj, d);
      } else if ("nom ns" in d || "nom np" in d) {
        noun_table(this_obj, d);
      } else if (
        "nom am" in d ||
        "nom af" in d ||
        "nom an" in d ||
        "nom ap" in d
      ) {
        adjective_table(this_obj, d);
      } else if ("inf" in d) {
        verb_table(this_obj, d);
      } else if (Object.keys(d).length > 0) {
        this_obj.text(JSON.stringify(d));
      } else {
        this_obj
          .append("p")
          .attr("id", "indcl")
          .append("i")
          .text("indeclinable");
      }
    }
  });

  const highlightFunc = (t) => {
    /**
     * INNER SEARCH AND HIGHLIGHT FUNCTION
     *
     * Finds and highlights a single search term within a phrase.
     * Handles complex edge cases: stress marks, parenthetical text, word boundaries.
     *
     * @param {string} word - Normalized search term to find (already lowercased and ї→і, ґ→г)
     * @param {string} phrase - Text to search within
     * @param {boolean} literal - If true, requires exact word boundaries on both sides.
     *                            If false, allows partial matches at word start.
     * @param {boolean} mustPreceed - If true, requires word boundary before match.
     *                                 If false, allows match anywhere (for single non-Latin chars).
     * @returns {string} HTML string with matches wrapped in <span class="highlight">
     *
     * Algorithm:
     * 1. Iterate character-by-character through phrase
     * 2. Track parenthesis depth (skip highlighting inside parentheses)
     * 3. On potential match start (beforeClear boundary), begin buffering
     * 4. Continue buffering while characters match (including stress marks)
     * 5. On complete match, wrap buffer in <span> if word boundaries satisfied
     * 6. Reset buffer and continue searching
     */
    const find = (word, phrase, literal, mustPreceed) => {
      console.log(word, phrase); // Debug logging

      // Character set for word boundary detection (Latin + Cyrillic)
      const letters =
        "abcdefghijklmnopqrstuvwxyzабвгдежзийклмнопрстуфхцчшщъыьэюяєії";

      let index = 0; // Current position in search term
      let parenthesis = 0; // Parenthesis nesting depth (positive = inside parens)
      let result = ""; // Accumulated result string
      let buffer = ""; // Buffer for current potential match

      // Iterate character-by-character through the phrase
      for (let i = 0; i < phrase.length; i++) {
        const thisLetter = phrase[i];

        // Track parenthesis depth (don't highlight inside parentheses)
        if (thisLetter === ")") {
          parenthesis++;
        }
        if (thisLetter === "(") {
          parenthesis--;
        }

        // Determine if we're at word boundaries
        const isBeginning = i === 0;
        const isEnd = i === phrase.length - 1;
        const beforeClear =
          isBeginning || !letters.includes(phrase[i - 1].toLowerCase());
        const afterClear =
          isEnd || !letters.includes(phrase[i + 1].toLowerCase());

        // Check if current character matches next expected character in search term
        // Normalize: ї→і, ґ→г for matching
        const isWordMatch =
          thisLetter.toLowerCase().replaceAll("ї", "і").replaceAll("ґ", "г") ===
          word[index];

        // Check if current character is stress mark (U+0301 combining acute)
        const isAccent = thisLetter === "́";

        // State: not currently matching (index === 0)
        if (index === 0) {
          // Check if we can start a match here
          // Conditions:
          // 1. Either fuzzy mode without mustPreceed, OR at word boundary (beforeClear)
          // 2. Character matches search term
          // 3. Not inside parentheses
          if (
            ((!literal && !mustPreceed) || beforeClear) &&
            isWordMatch &&
            parenthesis === 0
          ) {
            buffer += thisLetter;
            index++; // Advance to next character in search term

            // Check if we've matched the entire search term
            if (index === word.length) {
              // For literal mode, also check afterClear (word boundary after)
              if (!literal || afterClear)
                result += `<span class=highlight>${buffer}</span>`;
              else result += buffer; // Don't highlight if not at word boundary
              buffer = "";
              index = 0;
            }
          } else result += thisLetter; // Not a match, add to result as-is
        }
        // State: currently matching (index > 0)
        else if (isWordMatch || isAccent) {
          // Continue match: character matches OR it's a stress mark
          buffer += thisLetter;
          // Only advance index if not a stress mark, OR if stress mark also happens to match
          if (!isAccent || (isAccent && isWordMatch)) index++;

          // Check if match is complete (and no stress mark following)
          if (index === word.length && (isEnd || phrase[i + 1] !== "́")) {
            // For literal mode, check afterClear; for fuzzy always highlight
            if (!literal || afterClear)
              result += `<span class=highlight>${buffer}</span>`;
            else result += buffer;
            buffer = "";
            index = 0;
          }
        }
        // Match broken: flush buffer and reset
        else {
          result += buffer; // Add buffered text without highlighting
          buffer = "";
          index = 0;
          result += thisLetter; // Add current character
        }
      }
      result += buffer; // Flush any remaining buffer
      return result;
    };

    // Apply highlighting if search terms exist
    if (literalPhrases || fuzzyWords) {
      let ret_val = t;

      // Determine if word boundary required before match (mustPreceed)
      // False only if single fuzzy word with no Latin letters (e.g., single Cyrillic char)
      const mustPreceed = !(
        fuzzyWords.length === 1 &&
        fuzzyWords[0].replace(/[^a-z]/g, "").length === 0
      );

      // First pass: highlight all literal phrases (exact matches)
      for (const phrase of literalPhrases) {
        ret_val = find(phrase, ret_val, true, null);
      }

      // Second pass: highlight all fuzzy words (partial matches)
      for (const word of fuzzyWords) {
        ret_val = find(word, ret_val, false, mustPreceed);
      }
      return ret_val;
    }
    return t; // No search active, return text unchanged
  };

  /**
   * APPLY HIGHLIGHTING TO RENDERED CONTENT
   *
   * After all content is rendered, apply search highlighting to:
   * 1. Definition list items (<li> elements)
   * 2. Form table cells (<td> -> <p> elements)
   * 3. Word headwords (<p.title> -> <b> elements)
   *
   * Uses D3 to select elements and replace their HTML with highlighted versions.
   * Accesses bound data via this.__data__ (D3 data binding).
   */
  d3.selectAll("li").html(function () {
    return highlightFunc(this.__data__);
  }); // Definition text
  d3.selectAll("td")
    .selectAll("p")
    .html(function () {
      return highlightFunc(this.__data__);
    }); // Form text
  d3.selectAll("p.title > b").html(function () {
    return highlightFunc(this.__data__.word);
  }); // Word headword

  // Scroll behavior: jump to top on new search, stay put on infinite scroll
  if (!increase) {
    window.scrollTo({ top: 0 });
  }
};

/**
 * GLOBAL STATE VARIABLES
 *
 * These variables maintain the application state and are modified by user interactions.
 */

// Number of word entries currently displayed (for infinite scroll)
let numDisplayed = 300;

// Data arrays (all references to the same source data, but with different orderings)
let data; // Current active dataset (filtered/sorted), used for rendering
let freq_data; // Words sorted by frequency (most common first)
let alpha_data; // Words sorted alphabetically (Ukrainian collation order)

// Current filter settings
let curFilter; // Selected part-of-speech filter (e.g., 'noun', 'verb', or empty string for all)
let sortInfo = "freq"; // Current sort mode: 'freq', 'alpha', or 'alpha_rev'

// Search indexes (loaded from JSON files)
let index = new Object(); // Maps term IDs to {word: string, indexes: Set<wordIds>}
let wordDict = new Object(); // Maps first letter to Set of term IDs for typeahead

// Current search state
let searchTerm; // Normalized search query string
let literalPhrases; // Array of exact phrases from "quoted" terms
let fuzzyWords; // Array of fuzzy search words (partial matching)
let exactMatchOnly = false; // If true, only show exact matches to search term

/**
 * COPY EVENT HANDLER
 *
 * Removes Ukrainian stress marks (U+0301 combining acute) from copied text
 * unless "Copy Stress" checkbox is checked.
 *
 * This allows users to copy clean text without diacritics for easier input.
 */
document.addEventListener("copy", (event) => {
  // Check "Copy Stress" checkbox state
  if (!document.querySelector("#stressCopy").checked) {
    const selection = document.getSelection();
    // Remove all stress marks (U+0301) from copied text
    event.clipboardData.setData(
      "text/plain",
      selection.toString().replaceAll("\u0301", ""),
    );
    event.preventDefault(); // Prevent default copy behavior
  }
  // If checkbox is checked, allow default behavior (keep stress marks)
});

/**
 * DATA LOADING INITIALIZATION
 *
 * Loads three JSON files in parallel on page load:
 * 1. index.json - Search index mapping terms to word IDs
 * 2. word_dict.json - First-letter index for typeahead
 * 3. words.json - Full dictionary data (~50MB, all words with definitions and forms)
 *
 * After all files load, initializes the application:
 * - Parses URL parameters (search query, filters, sort order)
 * - Renders initial view
 * - Sets up URL state
 *
 * Implementation Notes:
 * - Uses Promise.all() for parallel fetching (faster than sequential)
 * - Converts array data to Sets for O(1) lookup performance
 * - Creates alpha_data with custom Cyrillic sorting
 * - All data stays in browser memory (no server-side pagination)
 */
Promise.all([
  // Load search index: term IDs -> {word, word IDs}
  fetch("index.json")
    .then((res) => res.json())
    .then((out) => {
      console.log("starting index.json");
      // Structure: { termId: [searchTerm, [wordId1, wordId2, ...]] }
      // Convert word ID arrays to Sets for O(1) lookup in search
      for (const o of Object.keys(out))
        index[o] = { word: out[o][0], indexes: new Set(out[o][1]) };
      console.log("done with index.json");
    })
    .catch((err) => {
      throw err;
    }),

  // Load first-letter index for typeahead: letter -> term IDs
  fetch("word_dict.json")
    .then((res) => res.json())
    .then((out) => {
      console.log("starting word_dict.json");
      // Structure: { letter: [termId1, termId2, ...] }
      // Convert term ID arrays to Sets for O(1) lookup
      for (const o of Object.keys(out)) wordDict[o] = new Set(out[o]);
      console.log("done with word_dict.json");
    })
    .catch((err) => {
      throw err;
    }),

  // Load full dictionary data (~50MB): all words with definitions and forms
  fetch("words.json")
    .then((res) => res.json())
    .then((out) => {
      // Store frequency-sorted data (as received from server)
      data = out;
      freq_data = data;

      // Render initial view (first 300 entries)
      main(data.slice(0, numDisplayed));

      /**
       * ALPHABETICAL SORTING
       *
       * Creates alphabetically sorted copy of data using custom Ukrainian collation.
       * Ukrainian alphabet order: а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я
       *
       * Implementation:
       * 1. Remove stress marks (U+0301) for sorting
       * 2. Convert to lowercase
       * 3. Map each character to custom sort key (ASCII-range for stable sorting)
       * 4. Join mapped characters for final sort key
       *
       * Note: Uses Object() instead of {} to create plain object (slight optimization)
       */
      alpha_data = d3.sort(
        [...data], // Spread to create shallow copy
        (x) =>
          x.word
            .toLowerCase()
            .replaceAll("\u0301", "") // Remove stress marks
            .split("") // Split into individual characters
            .map((y) => {
              // Map Ukrainian letters to ASCII sort keys (preserving alphabet order)
              const letters = Object({
                а: "0",
                б: "1",
                в: "2",
                г: "3",
                ґ: "4",
                д: "5",
                е: "6",
                є: "7",
                ж: "8",
                з: "9",
                и: ":",
                і: ";",
                ї: "<",
                й: "?",
                к: "@",
                л: "A",
                м: "B",
                н: "C",
                о: "D",
                п: "E",
                р: "F",
                с: "G",
                т: "H",
                у: "I",
                ф: "K",
                х: "L",
                ц: "M",
                ч: "N",
                ш: "O",
                щ: "P",
                ь: "Q",
                ю: "R",
                я: "S",
                "'": "T",
              });
              if (y in letters) return letters[y];
              return "";
            })
            .join(),
      );
    })
    .catch((err) => {
      throw err;
    }),
])
  .then(() => {
    readURL(window.location.href);
    setURL(true);
  })
  .catch((err) => {
    throw err;
  });

window.onscroll = (_) => {
  // Check if scrolled near bottom (within 1000px)
  if (
    window.innerHeight + window.scrollY + 1000 >=
    document.body.offsetHeight
  ) {
    numDisplayed += 100; // Increase display count
    main(data.slice(0, numDisplayed), true); // Re-render with more entries (increase=true to preserve scroll)
  }
};

/**
 * SEARCH INPUT HANDLER
 *
 * Triggers search when Enter key is pressed in search box.
 */
document.querySelector("input#search").addEventListener("keydown", (event) => {
  if (event.code === "Enter") {
    search();
  }
});

/**
 * GLOBAL KEYBOARD SHORTCUTS
 *
 * F3 or Ctrl+F: Focus search box
 * Escape: Clear search
 */
window.addEventListener("keydown", (event) => {
  // F3 or Ctrl+F: Focus search box (override browser's find)
  if (event.code === "F3" || (event.ctrlKey && event.code === "KeyF")) {
    event.preventDefault();
    document.querySelector("input#search").focus();
  }
  // Escape: Clear search
  if (event.code === "Escape") {
    clear();
  }
});

/**
 * LOOKUP WORDS
 *
 * Core lookup function that returns filtered and sorted word data without rendering.
 * This function encapsulates all data lookup logic and can be used by API endpoints.
 *
 * @param {Object} options - Lookup configuration object
 * @param {string} options.searchQuery - Search query string (optional)
 * @param {string} options.filter - Part-of-speech filter (e.g., 'noun', 'verb', optional)
 * @param {string} options.sort - Sort order: 'freq', 'alpha', or 'alpha_rev' (default: 'freq')
 * @param {number} options.limit - Maximum number of results to return (optional)
 * @param {boolean} options.exactMatchOnly - If true, only return exact matches to search term (default: false)
 *
 * @returns {Object} Result object containing:
 *   - data: Array of matching word objects
 *   - literalPhrases: Array of literal search phrases (for highlighting)
 *   - fuzzyWords: Array of fuzzy search words (for highlighting)
 *   - totalMatches: Total number of matches (before limit applied)
 *
 * @example
 * // Get all nouns sorted alphabetically
 * const result = lookupWords({ filter: 'noun', sort: 'alpha' });
 * console.log(result.data); // Array of noun word objects
 *
 * @example
 * // Search for a word with limit
 * const result = lookupWords({
 *   searchQuery: 'кіт',
 *   limit: 10
 * });
 * console.log(result.data); // Up to 10 matching words
 * console.log(result.totalMatches); // Total number of matches found
 *
 * @example
 * // For API endpoint:
 * app.get('/api/words', (req, res) => {
 *   const result = lookupWords({
 *     searchQuery: req.query.q,
 *     filter: req.query.filter,
 *     sort: req.query.sort || 'freq',
 *     limit: parseInt(req.query.limit) || 100
 *   });
 *   res.json(result);
 * });
 */
function lookupWords(options = {}) {
  const {
    searchQuery = null,
    filter = null,
    sort = "freq",
    limit = null,
    exactMatchOnly = false,
  } = options;

  // Start with appropriate sorted dataset
  let resultData;
  if (sort === "freq") {
    resultData = freq_data;
  } else if (sort === "alpha") {
    resultData = alpha_data;
  } else if (sort === "alpha_rev") {
    resultData = [...d3.reverse([...alpha_data])]; // Create copy to avoid mutating alpha_data
  } else {
    resultData = freq_data; // Default to frequency
  }

  // Apply part-of-speech filter
  if (filter) {
    resultData = d3.filter(resultData, (x) => x.pos === filter);
  }

  // Track search highlighting data
  let resultLiteralPhrases = null;
  let resultFuzzyWords = null;

  // Apply search query
  if (index && wordDict && searchQuery) {
    // Normalize search term: trim, collapse whitespace, lowercase
    let normalizedSearchTerm = searchQuery
      .trim()
      .replaceAll(/\s+/g, " ")
      .toLowerCase();

    // Extract literal phrases (text within double quotes)
    const literalResults = normalizedSearchTerm.matchAll(/"([^"]*)"/g);
    resultLiteralPhrases = Array();
    let literalWords = Array(); // Individual words from literal phrases (for index lookup)
    for (let literalRes of literalResults) {
      resultLiteralPhrases.push(literalRes[1]); // Store full phrase
      literalWords = literalWords.concat(literalRes[1].split(" ")); // Split into words
    }

    // Extract fuzzy words (text outside quotes)
    const fuzzyResults = normalizedSearchTerm
      .replaceAll(/"([^"]*)"/g, "")
      .trim()
      .replaceAll(/\s+/g, " ");
    resultFuzzyWords = Array();
    for (let fuzzyRes of fuzzyResults.split(" ")) {
      resultFuzzyWords.push(fuzzyRes);
    }

    // Accumulated set of matching word indexes (will be intersected across all search terms)
    let indexes;

    // Determine if substring matching allowed (canInclude)
    // True only if single fuzzy word with no Latin letters (e.g., single Cyrillic char)
    const canInclude =
      resultFuzzyWords.length === 1 &&
      resultFuzzyWords[0].replace(/[^a-z]/g, "").length === 0;

    // Process each fuzzy word (partial match at word start)
    for (let word of resultFuzzyWords) {
      if (!word) break; // Skip empty words

      // STEP 1: Find term IDs containing all letters in search word
      // Uses wordDict first-letter index for fast filtering
      let wordIndexes; // Set of term IDs containing all letters
      word = word.replaceAll("ї", "і").replaceAll("ґ", "г"); // Normalize

      // Intersect term ID sets for each unique letter in search word
      for (const l of new Set(word)) {
        if (!wordIndexes)
          wordIndexes = wordDict[l]; // First letter: start with its term IDs
        else {
          // Subsequent letters: intersect with existing set
          let _wordIndexes = new Set();
          for (const elem of wordDict[l]) {
            wordIndexes.has(elem) ? _wordIndexes.add(elem) : null;
          }
          wordIndexes = _wordIndexes;
        }
      }

      // STEP 2: Filter term IDs to those actually matching search word
      // Check if search word is prefix of term (or substring if canInclude)
      if (!indexes) {
        // First search word: initialize indexes set
        let results = d3.filter(Array.from(wordIndexes), (x) => {
          const thisWord = index[x]["word"];
          return canInclude
            ? thisWord.includes(word)
            : thisWord.startsWith(word) || thisWord === word;
        });
        // Map term IDs to word indexes (term -> word IDs)
        indexes = new Set();
        for (const res of results) {
          for (const elem of index[res]["indexes"]) indexes.add(elem);
        }
      } else {
        // Subsequent search words: intersect with existing indexes (AND logic)
        let results = d3.filter(Array.from(wordIndexes), (x) => {
          const thisWord = index[x]["word"];
          return canInclude
            ? thisWord.includes(word)
            : thisWord.startsWith(word) || thisWord === word;
        });
        let _indexes = new Set();
        for (const res of results) {
          // Only keep word indexes that were already in the set (intersection)
          for (const elem of index[res]["indexes"])
            indexes.has(elem) ? _indexes.add(elem) : null;
        }
        indexes = _indexes;
      }
    }

    // Process literal phrase words (same algorithm as fuzzy, but stricter matching later)
    console.log(literalWords);
    for (let word of literalWords) {
      if (!word) break; // Skip empty words

      // Normalize word for matching
      word = word.replaceAll("ї", "і").replaceAll("ґ", "г");

      // STEP 1: Find term IDs containing all letters
      let wordIndexes;
      for (const l of new Set(word)) {
        if (!wordIndexes) wordIndexes = wordDict[l];
        else {
          let _wordIndexes = new Set();
          for (const elem of wordDict[l]) {
            wordIndexes.has(elem) ? _wordIndexes.add(elem) : null;
          }
          wordIndexes = _wordIndexes;
        }
      }

      // STEP 2: Filter to exact matches only (literal words must match exactly)
      if (!indexes) {
        // First word: initialize indexes set
        let results = d3.filter(Array.from(wordIndexes), (x) => {
          const thisWord = index[x]["word"];
          return thisWord === word; // Exact match required for literal phrase words
        });
        indexes = new Set();
        for (const res of results) {
          for (const elem of index[res]["indexes"]) indexes.add(elem);
        }
      } else {
        // Subsequent words: intersect with existing indexes (AND logic)
        let results = d3.filter(Array.from(wordIndexes), (x) => {
          const thisWord = index[x]["word"];
          return thisWord === word;
        });
        let _indexes = new Set();
        for (const res of results) {
          for (const elem of index[res]["indexes"])
            indexes.has(elem) ? _indexes.add(elem) : null;
        }
        indexes = _indexes;
      }
    }

    /**
     * LITERAL PHRASE VERIFICATION
     *
     * The previous steps found words containing the individual words from literal phrases,
     * but didn't verify the full phrase appears. This section ensures the complete phrase
     * exists in either:
     * 1. Definitions (ignoring text in parentheses)
     * 2. Grammatical forms (exact match after normalization)
     * 3. Word headword (exact match after normalization)
     */
    for (const literalRes of resultLiteralPhrases) {
      // Get candidate words (already filtered to contain all words in phrase)
      let allData = d3.filter(resultData, (x) => indexes.has(x.index));

      /**
       * Helper: Filter definitions by phrase match
       * Removes text in parentheses, then checks if phrase appears
       */
      const filterFunc = (y) => {
        // Remove text inside parentheses (e.g., "(informal)" from definitions)
        let noParen = "";
        let paren = 0;
        for (const l of y) {
          if (l === "(")
            paren++; // Entering parenthesis
          else if (l === ")")
            paren--; // Exiting parenthesis
          else if (paren === 0) noParen += l; // Outside parentheses: keep character
        }
        // Check if phrase appears in parenthesis-free text (normalized)
        return noParen
          .toLowerCase()
          .replace("ї", "і")
          .replace("ґ", "г")
          .includes(literalRes);
      };

      /**
       * Helper: Flatten nested forms object
       * Recursively extracts all string values from forms object
       * (handles nested structure like verb tenses -> persons -> forms)
       */
      const unpack = (y) => {
        let result = [];
        if (typeof y === "object" && y !== null) {
          // Recursively unpack nested objects/arrays
          for (const x of Object.values(y)) result = result.concat(unpack(x));
        } else {
          // Base case: primitive value (string form)
          result = y;
        }
        return result;
      };

      // Filter to words where literal phrase actually appears
      let goodData = d3
        .filter(
          allData,
          (x) =>
            // Check if phrase in definitions (ignoring parentheticals)
            (
              d3.filter(x.defs, filterFunc) +
              // OR phrase in forms (exact match after normalization)
              d3.filter(unpack(x.forms), (y) => {
                return (
                  y
                    .replaceAll("\u0301", "")
                    .replaceAll("ї", "і")
                    .replaceAll("ґ", "г") === literalRes
                );
              })
            ).length > 0 ||
            // OR phrase matches word headword (exact match after normalization)
            x.word
              .replaceAll("\u0301", "")
              .replaceAll("ї", "і")
              .replaceAll("ґ", "г") === literalRes,
        )
        .map((x) => x.index); // Extract word indexes

      // Intersect with existing indexes (AND logic across all literal phrases)
      const _indexes = d3.filter(Array.from(indexes), (x) =>
        goodData.includes(x),
      );
      indexes = new Set();
      for (const elem of _indexes) {
        indexes.add(elem);
      }
    }

    // Apply final filter to data
    if (indexes) {
      resultData = d3.filter(resultData, (x) => indexes.has(x.index));
    }
  }

  // Apply exact match filter if enabled
  if (exactMatchOnly && searchQuery) {
    const normalizedQuery = searchQuery.toLowerCase().replace(/\u0301/g, "");
    resultData = resultData.filter((word) => {
      const normalizedWord = word.word.toLowerCase().replace(/\u0301/g, "");
      return normalizedWord === normalizedQuery;
    });
  }

  // Apply limit if specified
  const totalMatches = resultData.length;
  if (limit !== null && limit > 0) {
    resultData = resultData.slice(0, limit);
  }

  return {
    data: resultData,
    literalPhrases: resultLiteralPhrases,
    fuzzyWords: resultFuzzyWords,
    totalMatches: totalMatches,
  };
}

/**
 * HELPER: Apply Sort Order
 *
 * Updates the global `data` variable based on current `sortInfo` setting.
 * Does NOT re-render; caller must call main() after this.
 *
 * Sort modes:
 * - 'freq': Sort by frequency (most common words first) - uses freq_data
 * - 'alpha': Sort alphabetically A-Z - uses alpha_data
 * - 'alpha_rev': Sort alphabetically Z-A - uses reversed alpha_data
 *
 * Also resets numDisplayed to 300 (starting page size).
 *
 * @deprecated Use lookupWords() instead for new code
 */
function selectHelper() {
  // Set data to appropriate pre-sorted array
  if (sortInfo === "freq") {
    data = freq_data;
  } // Frequency order (default)
  if (sortInfo === "alpha") {
    data = alpha_data;
  } // Alphabetical order
  if (sortInfo === "alpha_rev") {
    data = d3.reverse(alpha_data);
  } // Reverse alphabetical

  // Reset display count to initial page size
  numDisplayed = 300;
}

/**
 * HELPER: Apply Part-of-Speech Filter
 *
 * Filters global `data` variable to only include words matching `curFilter` POS.
 * If curFilter is empty/falsy, no filtering is applied.
 * Does NOT re-render; caller must call main() after this.
 *
 * POS values: 'noun', 'verb', 'adjective', 'adverb', 'pronoun', etc.
 *
 * Also resets numDisplayed to 100 (smaller page size for filtered results).
 *
 * @deprecated Use lookupWords() instead for new code
 */
function filterHelper() {
  if (curFilter) {
    // Filter to only words with matching part of speech
    data = d3.filter(data, (x) => x.pos === curFilter);
    // Reduce initial display count for filtered views
    numDisplayed = 100;
  }
}

/**
 * HELPER: Apply Search Query
 *
 * Filters global `data` variable to only include words matching current searchTerm.
 * Also populates global `literalPhrases` and `fuzzyWords` arrays for highlighting.
 * Does NOT re-render; caller must call main() after this.
 *
 * @deprecated Use lookupWords() instead for new code
 */
function searchHelper() {
  // Reset search state
  literalPhrases = null;
  fuzzyWords = null;

  // Only search if indexes loaded and search term provided
  if (searchTerm) {
    // Use new lookupWords function
    const result = lookupWords({
      searchQuery: searchTerm,
      filter: curFilter,
      sort: sortInfo,
      exactMatchOnly: exactMatchOnly,
    });

    data = result.data;
    literalPhrases = result.literalPhrases;
    fuzzyWords = result.fuzzyWords;
    numDisplayed = 300;
  }
}

/**
 * SORT SELECTION HANDLER
 *
 * Called when user changes sort dropdown.
 * Updates sort order, re-applies filters and search, then re-renders.
 * Also updates URL to reflect new sort order.
 *
 * @param {boolean} changeURL - Not used (default true via search call)
 */
function select() {
  // Get selected sort order from dropdown
  sortInfo = document.querySelector("select#sort").value;

  // Use new lookupWords function
  const result = lookupWords({
    searchQuery: searchTerm,
    filter: curFilter,
    sort: sortInfo,
    exactMatchOnly: exactMatchOnly,
  });

  data = result.data;
  literalPhrases = result.literalPhrases;
  fuzzyWords = result.fuzzyWords;
  numDisplayed = result.data.length > 0 ? (curFilter ? 100 : 300) : 300;

  // Render updated data
  main(data.slice(0, numDisplayed));

  // Update URL to reflect new state
  setURL();
}

/**
 * FILTER SELECTION HANDLER
 *
 * Called when user changes part-of-speech filter dropdown.
 * Updates filter, re-applies sort and search, then re-renders.
 * Also updates URL to reflect new filter.
 */
function filter() {
  // Get selected filter from dropdown (empty string = no filter)
  curFilter = document.querySelector("select#filter").value;

  // Use new lookupWords function
  const result = lookupWords({
    searchQuery: searchTerm,
    filter: curFilter,
    sort: sortInfo,
    exactMatchOnly: exactMatchOnly,
  });

  data = result.data;
  literalPhrases = result.literalPhrases;
  fuzzyWords = result.fuzzyWords;
  numDisplayed = result.data.length > 0 ? (curFilter ? 100 : 300) : 300;

  // Render updated data
  main(data.slice(0, numDisplayed));

  // Update URL to reflect new state
  setURL();
}

/**
 * SEARCH HANDLER
 *
 * Called when user submits search query (Enter key or explicit call).
 * Normalizes search input, applies search logic, and re-renders results.
 * Optionally updates URL with search query.
 *
 * @param {boolean} changeURL - If true, updates browser URL (default).
 *                              If false, skips URL update (used internally).
 *
 * Search normalization:
 * - Smart quotes → standard quotes: ""«» → "
 * - Smart apostrophes → standard: ''‛ → '
 * - Letter normalization: ї→і, ґ→г (for Ukrainian keyboard variants)
 * - Strips non-letter/space/quote/apostrophe characters
 *
 * Workflow:
 * 1. If search term changed, reset to base sorted/filtered data
 * 2. Apply searchHelper() to filter by query
 * 3. Render results
 * 4. Update URL if requested
 */
function search(changeURL = true) {
  // Read exact match checkbox state
  exactMatchOnly = document.querySelector("#exactMatch").checked;

  const letters =
    "abcdefghijklmnopqrstuvwxyzабвгдежзийклмнопрстуфхцчшщъыьэюяєіїґ '\"";
  searchTerm = document.querySelector("input#search").value.toLowerCase();
  searchTerm = searchTerm
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("«", '"')
    .replaceAll("»", '"');
  searchTerm = searchTerm
    .replaceAll("‘", "'")
    .replaceAll("’", "'")
    .replaceAll("‛", "'");
  searchTerm = searchTerm.replaceAll("ї", "і").replaceAll("ґ", "г"); // letter normalization
  let newSearchTerm = "";
  for (const s of searchTerm) {
    if (letters.includes(s)) newSearchTerm += s;
  }
  searchTerm = newSearchTerm;

  // Use new lookupWords function
  const result = lookupWords({
    searchQuery: searchTerm,
    filter: curFilter,
    sort: sortInfo,
    exactMatchOnly: exactMatchOnly,
  });

  data = result.data;
  literalPhrases = result.literalPhrases;
  fuzzyWords = result.fuzzyWords;
  numDisplayed = result.data.length > 0 ? (curFilter ? 100 : 300) : 300;

  main(data.slice(0, numDisplayed));
  if (changeURL) setURL();
}

function setURL(replace = false) {
  // Get current UI state
  let urlSearchTerm = document.querySelector("input#search").value;
  let urlFilterTerm = document.querySelector("select#filter").value;
  let urlSortTerm = document.querySelector("select#sort").value;

  // Parse current URL to get base path (before #)
  let url = window.location.href;
  url = url.split(/[#\?\&]/).reverse(); // Split by URL component separators, reverse to pop base
  let base = url.pop(); // Get base URL (everything before #)

  // Build new URL
  let addedParam = false;
  base += "#search"; // Add hash anchor

  // Add search query parameter
  if (urlSearchTerm) {
    base += "?q=" + urlSearchTerm; // Note: browser will URL-encode automatically
    addedParam = true;
  }

  // Add filter parameter
  if (urlFilterTerm) {
    const startChar = addedParam ? "&" : "?"; // First param uses ?, subsequent use &
    base += startChar + "f=" + urlFilterTerm;
    addedParam = true;
  }

  // Add sort parameter
  if (urlSortTerm) {
    const startChar = addedParam ? "&" : "?";
    base += startChar + "s=" + urlSortTerm;
    addedParam = true;
  }

  // Add exact match parameter
  if (exactMatchOnly) {
    const startChar = addedParam ? "&" : "?";
    base += startChar + "e=1";
  }

  // Update browser history
  if (replace) {
    window.history.replaceState("", "", base);
  } // Don't add history entry
  else {
    window.history.pushState("", "", base);
  } // Add new history entry
}

/**
 * READ URL HANDLER
 *
 * Parses URL parameters and sets application state accordingly.
 * Called on page load and when user navigates with back/forward buttons.
 *
 * @param {string} urlRaw - Full URL to parse
 *
 * URL Parameters:
 * - q: Search query
 * - f: Part-of-speech filter
 * - s: Sort order
 *
 * Defaults:
 * - s: 'freq' (frequency order)
 * - f: '' (no filter)
 * - q: '' (no search)
 *
 * Workflow:
 * 1. Parse URL into parameter key-value pairs
 * 2. Update UI form elements (search box, dropdowns)
 * 3. Update global state variables (sortInfo, curFilter)
 * 4. Apply sort, filter, and search
 * 5. Render results (search() handles final render)
 */
function readURL(urlRaw) {
  console.log("reading URL");
  console.log(window.location.href);

  // Parse URL into components (split by #, ?, &)
  let url = urlRaw.split(/[#\?\&]/).reverse();
  url.pop(); // Remove base URL (not needed)

  // Extract parameter key-value pairs
  let params = [];
  while (url.length > 0) {
    params.push(url.pop().split(/=/)); // Split "key=value" into ["key", "value"]
  }

  // Default values if parameter not present in URL
  let defaults = {
    s: "freq", // Sort by frequency
    f: "", // No filter
    q: "", // No search
    e: false, // Exact match off by default
  };

  // Track which parameters were found in URL
  let found = {
    s: false,
    f: false,
    q: false,
    e: false,
  };

  // Map parameter keys to UI element selectors
  let funcs = {
    s: "select#sort", // Sort dropdown
    f: "select#filter", // Filter dropdown
    q: "input#search", // Search input
    e: "#exactMatch", // Exact match checkbox
  };

  // Apply URL parameters to UI elements
  for (let [var_, val_] of params) {
    if (var_ in funcs) {
      if (var_ === "e") {
        // Handle checkbox (checked property, not value)
        document.querySelector(funcs[var_]).checked = val_ === "1";
      } else {
        // Handle text inputs and selects
        document.querySelector(funcs[var_]).value = decodeURI(val_); // Decode URL encoding
      }
      found[var_] = true;
    }
  }

  // Apply defaults for missing parameters
  for (const i of Object.keys(found)) {
    if (!found[i]) {
      if (i === "e") {
        // Handle checkbox default
        document.querySelector(funcs[i]).checked = defaults[i];
      } else {
        // Handle text input/select defaults
        document.querySelector(funcs[i]).value = defaults[i];
      }
    }
  }

  // Update global state from UI elements
  sortInfo = document.querySelector("select#sort").value;
  curFilter = document.querySelector("select#filter").value;

  // Normalize search term (same as search() function)
  search(false); // Search (false = don't update URL, would create loop)
}

/**
 * CLEAR SEARCH HANDLER
 *
 * Clears search input and re-runs search to show all results.
 * Called by "Clear" button and Escape key.
 */
function clear() {
  // Clear search input box
  document.querySelector("input#search").value = "";
  // Re-run search (with empty query, shows all results)
  search();
}

/**
 * CLEAR BUTTON HANDLER
 *
 * Binds clear() function to click event on clear button.
 */
d3.select("#clear").on("click", clear);

/**
 * BROWSER NAVIGATION HANDLER
 *
 * Handles browser back/forward button clicks.
 * Reads URL parameters and updates application state to match.
 *
 * @param {PopStateEvent} event - Browser navigation event
 *
 * This enables full URL-based navigation:
 * - Back button restores previous search/filter/sort state
 * - Forward button restores next state
 * - Bookmarked URLs restore exact state
 */
window.onpopstate = (event) => {
  if (event) {
    console.log(event.srcElement.location.href);
    // Parse new URL and update application state
    readURL(event.srcElement.location.href);
  }
};
