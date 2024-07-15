"use strict";
const earleyItem = (rule, next, start) => ({
    rule,
    next,
    start
});
// 这个是定义的规则
const exampleGrammar = {
    start_rule_name: 'Sum', // 起始的规则名称是 Sum
    0: { name: 'Sum', 0: 'Sum', 1: classSymbol('+-'), 2: 'Product' },
    1: { name: 'Sum', 0: 'Product' },
    2: { name: 'Product', 0: 'Product', 1: classSymbol('*/'), 2: 'Factor' },
    3: { name: 'Product', 0: 'Factor' },
    4: { name: 'Factor', 0: charSymbol('('), 1: 'Sum', 2: charSymbol(')') },
    5: { name: 'Factor', 0: 'Number' },
    6: { name: 'Number', 0: rangeSymbol('09'), 1: 'Number' },
    7: { name: 'Number', 0: rangeSymbol('09') }
};
// Utility functions for terminal symbols
function charSymbol(c) {
    return (input, index) => input.charAt(index) === c;
}
function rangeSymbol(r) {
    return (input, index) => {
        const code = input.charCodeAt(index);
        return code >= r.charCodeAt(0) && code <= r.charCodeAt(1);
    };
}
function classSymbol(c) {
    return (input, index) => c.includes(input.charAt(index));
}
// Main Earley parsing functions
function nextSymbol(grammar, item) {
    return grammar[item.rule][item.next];
}
function getRuleName(grammar, item) {
    return grammar[item.rule].name;
}
function equal(item1, item2) {
    return item1.rule === item2.rule && item1.start === item2.start && item1.next === item2.next;
}
function append(set, item) {
    for (let i = 0; i < set.length; i++) {
        if (equal(set[i], item))
            return;
    }
    set.push(item);
}
function complete(S, i, j, grammar) {
    const item = S[i][j];
    for (const oldItem of S[item.start]) {
        if (nextSymbol(grammar, oldItem) === getRuleName(grammar, item)) {
            append(S[i], { rule: oldItem.rule, next: oldItem.next + 1, start: oldItem.start });
        }
    }
}
function scan(S, i, j, symbol, input) {
    const item = S[i][j];
    if (symbol(input, i)) {
        if (!S[i + 1])
            S[i + 1] = [];
        append(S[i + 1], { rule: item.rule, next: item.next + 1, start: item.start });
    }
}
function predict(S, i, symbol, grammar) {
    for (let ruleIndex = 0; ruleIndex < Object.keys(grammar).length; ruleIndex++) {
        const rule = grammar[ruleIndex];
        if (rule.name === symbol) {
            append(S[i], { rule: ruleIndex, next: 1, start: i });
        }
    }
}
function buildItems(grammar, input) {
    const S = [[]];
    for (let i = 0; i < Object.keys(grammar).length; i++) {
        const rule = grammar[i];
        if (rule.name === grammar.start_rule_name) {
            append(S[0], { rule: i, start: 0, next: 0 });
        }
    }
    let i = 0;
    while (i < S.length) {
        let j = 0;
        while (j < S[i].length) {
            const symbol = nextSymbol(grammar, S[i][j]);
            if (symbol === undefined) {
                complete(S, i, j, grammar);
            }
            else if (typeof symbol === 'function') {
                scan(S, i, j, symbol, input);
            }
            else if (typeof symbol === 'string') {
                predict(S, i, symbol, grammar);
            }
            else {
                throw new Error('illegal rule');
            }
            j++;
        }
        i++;
    }
    return S;
}
// Test utilities
function hasPartialParse(S, i, grammar) {
    const set = S[i];
    for (const item of set) {
        const rule = grammar[item.rule];
        if (rule.name === grammar.start_rule_name && item.next > Object.keys(rule).length - 1 && item.start === 0) {
            return true;
        }
    }
    return false;
}
function hasCompleteParse(S, grammar) {
    return hasPartialParse(S, S.length - 1, grammar);
}
function lastPartialParse(S, grammar) {
    for (let i = S.length - 1; i >= 0; i--) {
        if (hasPartialParse(S, i, grammar))
            return i;
    }
    return null;
}
function diagnose(S, grammar, input) {
    if (hasCompleteParse(S, grammar)) {
        console.log('The input has been recognised. Congratulations!');
    }
    else {
        if (S.length === input.length + 1) {
            console.log('The whole input made sense. Maybe it is incomplete?');
        }
        else {
            console.log('The input stopped making sense at character', S.length - 1);
        }
        const lpp = lastPartialParse(S, grammar);
        if (lpp !== null) {
            console.log('This beginning of the input has been recognised:', input.substring(0, lpp));
        }
        else {
            console.log("The beginning of the input couldn't be parsed.");
        }
    }
}
// Pretty printer
class PrettyPrinter {
    constructor() {
        this.lines = [];
    }
    write(...args) {
        const line = this.lines[this.lines.length - 1];
        if (!line)
            return;
        line[line.length - 1] += args.join(' ');
    }
    col() {
        const line = this.lines[this.lines.length - 1];
        if (!line)
            return;
        line.push('');
    }
    line() {
        this.lines.push(['']);
    }
    print(indent = 0) {
        const maxCols = this.lines.reduce((max, line) => Math.max(max, line.length), 0);
        const colWidths = Array(maxCols).fill(0);
        for (const line of this.lines) {
            line.forEach((col, i) => {
                colWidths[i] = Math.max(colWidths[i], col.length);
            });
        }
        for (const line of this.lines) {
            process.stdout.write(' '.repeat(indent));
            line.forEach((col, i) => {
                process.stdout.write(col + ' '.repeat(colWidths[i] - col.length));
            });
            console.log();
        }
    }
}
// Print all Earley items
function printS(S, grammar) {
    for (let i = 0; i < S.length; i++) {
        console.log(`    === ${i} ===`);
        const pp = new PrettyPrinter();
        for (const st of S[i]) {
            pp.line();
            pp.col();
            pp.write(getRuleName(grammar, st));
            pp.col();
            pp.write(' ->');
            for (let k = 0; k < Object.keys(grammar[st.rule]).length; k++) {
                const symbol = grammar[st.rule][k];
                if (k === st.next)
                    pp.write(' •');
                if (typeof symbol === 'string')
                    pp.write(' ', symbol);
                else if (typeof symbol === 'function')
                    pp.write(' ', symbol);
            }
            if (st.next > Object.keys(grammar[st.rule]).length - 1)
                pp.write(' •');
            pp.col();
            pp.write(`  (${st.start})`);
        }
        pp.print(4);
        console.log();
    }
}
// Sample input and usage
const input = '1+(2*3+4)'; // Tinker with this first.
const S = buildItems(exampleGrammar, input);
console.log('Input:', input); // print the input
printS(S, exampleGrammar); // print all the internal state
diagnose(S, exampleGrammar, input); // tell if the input is OK or not
