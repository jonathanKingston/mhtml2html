// components.js - Imports from utils.js
import { formatNumber, formatCurrency, formatDate } from './utils.js';

export class StatsCard {
    constructor(element, options = {}) {
        this.element = element;
        this.options = options;
        this.render();
    }

    render() {
        const { label, value, type = 'number', change } = this.options;

        let displayValue = value;
        if (type === 'currency') {
            displayValue = formatCurrency(value);
        } else if (type === 'number') {
            displayValue = formatNumber(value);
        } else if (type === 'date') {
            displayValue = formatDate(value);
        }

        this.element.innerHTML = `
      <div class="stats-card-inner">
        <div class="stats-label">${label}</div>
        <div class="stats-value">${displayValue}</div>
        ${
            change !== undefined
                ? `
          <div class="stats-change ${change >= 0 ? 'positive' : 'negative'}">
            ${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%
          </div>
        `
                : ''
        }
      </div>
    `;
    }
}

export class DataList {
    constructor(element, items = []) {
        this.element = element;
        this.items = items;
        this.render();
    }

    render() {
        this.element.innerHTML = this.items
            .map(
                (item) => `
      <div class="data-list-item">
        <span class="item-name">${item.name}</span>
        <span class="item-value">${formatNumber(item.value)}</span>
      </div>
    `
            )
            .join('');
    }
}
