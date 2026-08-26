export class DiceRoller {
    static rollExpression(expression: string | number, stats: Record<string, number> = {}): number {
        if (typeof expression === 'number') return expression;
        
        let expr = expression.trim();
        
        // Replace stat references (e.g. STR+DEX)
        for (const [stat, val] of Object.entries(stats)) {
            expr = expr.replace(new RegExp(`\\b${stat}\\b`, 'g'), val.toString());
        }

        // Handle basic addition/subtraction
        const parts = expr.split(/(?=[+-])/);
        let total = 0;

        for (let part of parts) {
            let sign = 1;
            if (part.startsWith('+')) {
                part = part.substring(1);
            } else if (part.startsWith('-')) {
                sign = -1;
                part = part.substring(1);
            }

            part = part.trim();
            if (!part) continue;

            const diceMatch = part.match(/^(\d+)d(\d+)$/i);
            if (diceMatch) {
                const count = parseInt(diceMatch[1], 10);
                const sides = parseInt(diceMatch[2], 10);
                let rollTotal = 0;
                for (let i = 0; i < count; i++) {
                    rollTotal += Math.floor(Math.random() * sides) + 1;
                }
                total += sign * rollTotal;
            } else {
                const num = parseInt(part, 10);
                if (!isNaN(num)) {
                    total += sign * num;
                }
            }
        }

        return total;
    }

    static calculateDamageModifier(str: number, siz: number): string {
        const total = str + siz;
        if (total <= 5) return "-1d8";
        if (total <= 10) return "-1d6";
        if (total <= 15) return "-1d4";
        if (total <= 20) return "-1d2";
        if (total <= 25) return "+0";
        if (total <= 30) return "+1d2";
        if (total <= 35) return "+1d4";
        if (total <= 40) return "+1d6";
        if (total <= 45) return "+1d8";
        if (total <= 50) return "+1d10";
        if (total <= 60) return "+1d12";
        if (total <= 70) return "+2d6";
        if (total <= 80) return "+2d8";
        return "+2d10"; // Simplification for extremes
    }

    static calculateActionPoints(int: number, dex: number): number {
        return Math.ceil((int + dex) / 12);
    }

    static calculateInitiative(int: number, dex: number): number {
        return Math.ceil((int + dex) / 2);
    }
}
