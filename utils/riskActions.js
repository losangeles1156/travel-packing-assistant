const LuggageRule = {
  STRICT_CARRY_ON: 'Strict_CarryOn',
  STRICT_CHECKED: 'Strict_Checked',
};

export const applyRiskResolution = (items, issue, action) => {
  return (items || []).map((item) => {
    if (item.id !== issue.itemId) return item;

    if (action === 'MOVE_TO_CARRY_ON') {
      return {
        ...item,
        rule: LuggageRule.STRICT_CARRY_ON,
        checked: true,
        quantity: Math.max(1, item.quantity || 0),
      };
    }

    if (action === 'MOVE_TO_CHECKED') {
      return {
        ...item,
        rule: LuggageRule.STRICT_CHECKED,
        checked: true,
        quantity: Math.max(1, item.quantity || 0),
      };
    }

    return {
      ...item,
      checked: false,
      quantity: 0,
    };
  });
};
