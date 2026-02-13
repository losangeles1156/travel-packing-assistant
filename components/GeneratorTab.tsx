
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PackingItem, TripDetails, LuggageRule, ItemCategory, CustomRuleDef, RuleType, PreFlightTask } from '../types';
import { DEFAULT_DATABASE, PRE_FLIGHT_TASKS, TRIP_TEMPLATES } from '../constants';
import { RISK_RULESET_META, SUPPORTED_COUNTRIES, SUPPORTED_DIRECTIONS } from '../constants/riskKeywordRules.js';
import ResultView from './ResultView';
import { trackEvent } from '../services/analyticsService';
import { formatDateLocal, getDefaultTripDates } from '../utils/date';
import { buildCustomRuleById, getGeneratorRuleConfig } from '../utils/packingRules';
import { apiUrl } from '../services/apiBase';
import { analyzePackingRisks } from '../utils/riskEngine.js';
import { applyRiskResolution } from '../utils/riskActions.js';
import { compareRiskIssues, getConsequenceLabel } from '../utils/riskPriority.js';
import { getRiskBannerCopy, resolveRiskCopyVariant } from '../utils/riskBannerCopy.js';
import {
  createEmptyListSnapshot,
  getActiveListId,
  ListIndexEntry,
  ListSnapshot,
  loadListIndex,
  loadListSnapshot,
  saveListSnapshot,
  setActiveListId as persistActiveListId,
  touchTripDetailsKey,
} from '../services/listStorageService';

const GeneratorTab: React.FC = () => {
  const [step, setStep] = useState<number>(0); // 0: Input, 1: Customize, 2: Result

  const [listIndex, setListIndex] = useState<ListIndexEntry[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const hydrateDoneRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastStepTrackedRef = useRef<number | null>(null);
  const lastBlockingCountRef = useRef<number | null>(null);
  const noResultSearchRef = useRef<string>('');
  const searchTimerRef = useRef<number | null>(null);
  
  // Step 0 Form State
  const [destination, setDestination] = useState('');
  const [tripCountry, setTripCountry] = useState<'JP' | 'KR' | 'SG' | 'VN' | 'TH'>('JP');
  const [tripDirection, setTripDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');

  const [dates, setDates] = useState(() => getDefaultTripDates());

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('tpa_template_last') || '';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tpa_template_last', selectedTemplateId);
  }, [selectedTemplateId]);

  const setDurationDays = (days: number) => {
    if (!dates.start) return;
    const start = new Date(dates.start);
    if (!Number.isFinite(start.getTime())) return;
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, days - 1));
    setDates(prev => ({ ...prev, end: formatDateLocal(end) }));
    trackEvent('quick_duration_set', { days });
  };

  // Derived Duration
  const duration = useMemo(() => {
    if (!dates.start || !dates.end) return 0;
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    const diffTime = end.getTime() - start.getTime();
    // Difference in days + 1 (inclusive)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return diffDays > 0 ? diffDays : 0;
  }, [dates]);

  // Trip Data for Result
  const [finalTripDetails, setFinalTripDetails] = useState<TripDetails>({
    destination: '',
    startDate: '',
    duration: 0,
    country: 'JP',
    direction: 'OUTBOUND',
  });
  
  const [items, setItems] = useState<PackingItem[]>([]);

  // LIFTED STATE: Progress tracking (Tasks & Packing)
  // This ensures state is preserved when user hits "Back" from ResultView
  const [tasks, setTasks] = useState<PreFlightTask[]>(PRE_FLIGHT_TASKS);
  const [packedItemIds, setPackedItemIds] = useState<Set<string>>(new Set());
  
  // Filter & Sort State
  const [activeCategory, setActiveCategory] = useState<ItemCategory | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'category' | 'rule' | 'weight'>('default');
  const [itemSearch, setItemSearch] = useState('');
  
  // Custom item inputs
  const [customItemName, setCustomItemName] = useState('');
  const [customItemWeight, setCustomItemWeight] = useState('');
  const [customItemRule, setCustomItemRule] = useState<RuleType>(LuggageRule.FLEXIBLE_CHECKED);
  
  // Custom Rules State
  const [customRuleDefs, setCustomRuleDefs] = useState<CustomRuleDef[]>([]);
  const [showRuleManager, setShowRuleManager] = useState(false);

  const customRuleById = useMemo(() => buildCustomRuleById(customRuleDefs), [customRuleDefs]);
  
  // Rule Creator Form State
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleIcon, setNewRuleIcon] = useState('fa-star');
  const [newRuleBehavior, setNewRuleBehavior] = useState<'CARRY' | 'CHECK'>('CARRY');
  const [newRuleColor, setNewRuleColor] = useState('bg-purple-50 text-purple-600 border-purple-200');
  const [riskGateTouched, setRiskGateTouched] = useState(false);
  const [riskCopyVariant, setRiskCopyVariant] = useState<'serious' | 'friendly'>('serious');
  const [expandedRiskKey, setExpandedRiskKey] = useState<string | null>(null);
  const [lastBulkResolveSnapshot, setLastBulkResolveSnapshot] = useState<PackingItem[] | null>(null);
  const [lastBulkResolveCount, setLastBulkResolveCount] = useState(0);

  const availableIcons = [
    { class: 'fa-star', label: '星號', unicode: '\uf005' },
    { class: 'fa-wine-glass', label: '易碎', unicode: '\uf4e3' },
    { class: 'fa-biohazard', label: '危險', unicode: '\uf780' },
    { class: 'fa-guitar', label: '樂器', unicode: '\uf7a6' },
    { class: 'fa-baby', label: '嬰兒', unicode: '\uf77c' },
    { class: 'fa-snowflake', label: '冷藏', unicode: '\uf2dc' },
    { class: 'fa-camera', label: '器材', unicode: '\uf030' },
    { class: 'fa-gem', label: '貴重', unicode: '\uf3a5' },
  ];

  const availableColors = [
    { class: 'bg-purple-50 text-purple-600 border-purple-200', label: '紫色' },
    { class: 'bg-pink-50 text-pink-600 border-pink-200', label: '粉紅' },
    { class: 'bg-teal-50 text-teal-600 border-teal-200', label: '青色' },
    { class: 'bg-yellow-50 text-yellow-600 border-yellow-200', label: '黃色' },
    { class: 'bg-indigo-50 text-indigo-600 border-indigo-200', label: '深藍' },
  ];

  const handleStart = () => {
    if (!destination || !dates.start || !dates.end) {
      alert("請填寫完整的旅行資訊");
      return;
    }
    if (duration <= 0) {
      alert("回程日期必須晚於或等於去程日期");
      return;
    }

    const trip = {
      destination,
      startDate: dates.start,
      endDate: dates.end,
      duration,
      country: tripCountry,
      direction: tripDirection,
    };

    setFinalTripDetails({
      destination: trip.destination,
      startDate: trip.startDate,
      duration: trip.duration,
      country: trip.country,
      direction: trip.direction,
    });

    trackEvent('trip_started', {
      destination,
      startDate: dates.start,
      endDate: dates.end,
      duration,
      country: tripCountry,
      direction: tripDirection,
    });

    touchTripDetailsKey(trip);

    // Initialize list based on days if items empty (first run), or preserve existing selection if just updating details?
    // For simplicity, if items are empty, load default. If user goes back to input, we probably want to keep their items.
    const baseItems: PackingItem[] = DEFAULT_DATABASE.map(item => ({
      ...item,
      quantity: item.isDaily ? duration : 1,
      checked: true,
    }));

    const selectedTemplate = TRIP_TEMPLATES.find(t => t.id === selectedTemplateId) || null;
    const templateItems: PackingItem[] = selectedTemplate
      ? selectedTemplate.addItems.map(item => ({
          ...item,
          quantity: item.isDaily ? duration : 1,
          checked: true,
        }))
      : [];

    const nextItems = [...baseItems, ...templateItems];
    const nextTasks = selectedTemplate ? [...PRE_FLIGHT_TASKS, ...selectedTemplate.addTasks] : PRE_FLIGHT_TASKS;

    setItems(nextItems);
    setTasks(nextTasks);
    setPackedItemIds(new Set());
    setCustomRuleDefs([]);
    setActiveCategory('ALL');
    setSortBy('default');

    if (selectedTemplate) {
      trackEvent('template_applied', {
        templateId: selectedTemplate.id,
        destination,
        duration,
      });
    }

    const snapshot = createEmptyListSnapshot({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      duration: trip.duration,
      country: trip.country,
      direction: trip.direction,
      items: nextItems,
      tasks: nextTasks,
    });
    saveListSnapshot(snapshot);
    persistActiveListId(snapshot.id);
    setActiveListId(snapshot.id);
    setListIndex(loadListIndex());
    setStep(1);
  };

  const resetToNewTrip = () => {
    setActiveListId(null);
    setStep(0);
    setDestination('');
    setTripCountry('JP');
    setTripDirection('OUTBOUND');
    setDates(getDefaultTripDates());
    setFinalTripDetails({ destination: '', startDate: '', duration: 0, country: 'JP', direction: 'OUTBOUND' });
    setItems([]);
    setTasks(PRE_FLIGHT_TASKS);
    setPackedItemIds(new Set());
    setActiveCategory('ALL');
    setSortBy('default');
    setCustomItemName('');
    setCustomItemWeight('');
    setCustomItemRule(LuggageRule.FLEXIBLE_CHECKED);
    setCustomRuleDefs([]);
    setShowRuleManager(false);
    setNewRuleName('');
    setNewRuleDesc('');
    setNewRuleIcon('fa-star');
    setNewRuleBehavior('CARRY');
    setNewRuleColor('bg-purple-50 text-purple-600 border-purple-200');
  };

  const applySnapshot = (snapshot: ListSnapshot) => {
    setActiveListId(snapshot.id);
    setDestination(snapshot.trip.destination);
    setTripCountry(snapshot.trip.country || 'JP');
    setTripDirection(snapshot.trip.direction || 'OUTBOUND');
    setDates({ start: snapshot.trip.startDate, end: snapshot.trip.endDate });
    setFinalTripDetails({
      destination: snapshot.trip.destination,
      startDate: snapshot.trip.startDate,
      duration: snapshot.trip.duration,
      country: snapshot.trip.country || 'JP',
      direction: snapshot.trip.direction || 'OUTBOUND',
    });
    setItems(snapshot.items);
    setTasks(snapshot.tasks);
    setPackedItemIds(new Set(snapshot.packedItemIds));
    setCustomRuleDefs(snapshot.customRules);
    setActiveCategory(snapshot.ui.activeCategory);
    setSortBy(snapshot.ui.sortBy);
    setStep(snapshot.ui.step);
    touchTripDetailsKey(snapshot.trip);
  };

  const buildSnapshot = (id: string, updatedAt: string): ListSnapshot => {
    return {
      schemaVersion: 1,
      id,
      updatedAt,
      ui: {
        step,
        activeCategory,
        sortBy,
      },
      trip: {
        destination,
        startDate: dates.start,
        endDate: dates.end,
        duration,
        country: tripCountry,
        direction: tripDirection,
      },
      items,
      tasks,
      packedItemIds: Array.from(packedItemIds),
      customRules: customRuleDefs,
    };
  };

  const handleOpenRecentList = (id: string) => {
    const snapshot = loadListSnapshot(id);
    if (!snapshot) return;
    persistActiveListId(id);
    applySnapshot(snapshot);
    setListIndex(loadListIndex());
  };

  const handleShare = async (): Promise<{ url: string | null; reason?: string; status?: number }> => {
    if (!activeListId) return { url: null, reason: 'no_active_list' };
    if (typeof window === 'undefined') return { url: null, reason: 'no_window' };

    const updatedAt = new Date().toISOString();
    const snapshot = buildSnapshot(activeListId, updatedAt);

    try {
      const res = await fetch(apiUrl('/share'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      if (!res.ok) return { url: null, reason: 'server_error', status: res.status };
      const data = await res.json();
      const shareId = data?.shareId;
      if (!shareId || typeof shareId !== 'string') return { url: null, reason: 'bad_response' };

      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      return { url: `${baseUrl}?share=${encodeURIComponent(shareId)}` };
    } catch {
      return { url: null, reason: 'network_error' };
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('share');
      if (shareId) {
        try {
          const res = await fetch(apiUrl(`/share/${encodeURIComponent(shareId)}`));
          if (!res.ok) throw new Error('not ok');
          const data = await res.json();
          const snapshot = data?.snapshot as ListSnapshot | undefined;
          if (!snapshot || snapshot.schemaVersion !== 1 || typeof snapshot.id !== 'string') {
            throw new Error('bad snapshot');
          }
          if (cancelled) return;

          saveListSnapshot(snapshot);
          persistActiveListId(snapshot.id);
          applySnapshot(snapshot);
          setListIndex(loadListIndex());
          hydrateDoneRef.current = true;

          params.delete('share');
          const nextSearch = params.toString();
          const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
          window.history.replaceState({}, '', nextUrl);

          trackEvent('share_loaded', { shareId });
          return;
        } catch {
          trackEvent('share_load_failed', { shareId });
          alert('分享連結無效或已失效');
        }
      }

      const index = loadListIndex();
      if (cancelled) return;
      setListIndex(index);

      const preferredId = getActiveListId();
      const fallbackId = index[0]?.id ?? null;
      const idToLoad = preferredId ?? fallbackId;
      if (!idToLoad) {
        hydrateDoneRef.current = true;
        return;
      }

      const snapshot = loadListSnapshot(idToLoad);
      if (!snapshot) {
        hydrateDoneRef.current = true;
        return;
      }

      applySnapshot(snapshot);
      hydrateDoneRef.current = true;
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrateDoneRef.current) return;
    if (!activeListId) return;
    if (typeof window === 'undefined') return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      const snapshot = buildSnapshot(activeListId, updatedAt);
      saveListSnapshot(snapshot);
      setListIndex(loadListIndex());
      touchTripDetailsKey(snapshot.trip);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    activeListId,
    activeCategory,
    customRuleDefs,
    dates.end,
    dates.start,
    destination,
    tripCountry,
    tripDirection,
    duration,
    items,
    packedItemIds,
    sortBy,
    step,
    tasks,
  ]);

  const handleUpdateQuantity = (id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQ, checked: newQ > 0 };
      }
      return item;
    }));
  };

  const handleToggleCheck = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const resolveRiskIssue = (issue: {
    itemId: string;
    itemName: string;
    type: string;
    severity: string;
  }, action: 'MOVE_TO_CARRY_ON' | 'MOVE_TO_CHECKED' | 'REMOVE_ITEM') => {
    setLastBulkResolveSnapshot(null);
    setLastBulkResolveCount(0);
    setItems(prev => applyRiskResolution(prev, issue, action));

    trackEvent('risk_issue_resolved', {
      issueType: issue.type,
      severity: issue.severity,
      itemId: issue.itemId,
      itemName: issue.itemName,
      action,
      country: tripCountry,
      direction: tripDirection,
      rulesetVersion: RISK_RULESET_META.version,
    });
  };

  const getDefaultRiskAction = (issue: { type: string }) => {
    if (issue.type === 'MUST_CARRY_ON') return 'MOVE_TO_CARRY_ON' as const;
    if (issue.type === 'MUST_CHECKED' || issue.type === 'LIQUID_LIMIT') return 'MOVE_TO_CHECKED' as const;
    return 'REMOVE_ITEM' as const;
  };

  const resolveAllBlockingRisks = () => {
    const blockingIssues = riskReport.issues.filter((i) => i.blocking);
    if (blockingIssues.length === 0) return;
    setLastBulkResolveSnapshot(items.map((item) => ({ ...item })));
    setLastBulkResolveCount(blockingIssues.length);
    let nextItems = items;
    blockingIssues.forEach((issue) => {
      nextItems = applyRiskResolution(nextItems, issue, getDefaultRiskAction(issue));
    });
    setItems(nextItems);
    trackEvent('risk_bulk_resolved', {
      count: blockingIssues.length,
      country: tripCountry,
      direction: tripDirection,
      rulesetVersion: RISK_RULESET_META.version,
    });
  };

  const undoBulkRiskResolution = () => {
    if (!lastBulkResolveSnapshot) return;
    setItems(lastBulkResolveSnapshot);
    trackEvent('risk_bulk_resolve_undone', {
      count: lastBulkResolveCount,
      country: tripCountry,
      direction: tripDirection,
      rulesetVersion: RISK_RULESET_META.version,
    });
    setLastBulkResolveSnapshot(null);
    setLastBulkResolveCount(0);
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const categoryToUse = activeCategory === 'ALL' ? ItemCategory.MISC : activeCategory;
    
    const newItem: PackingItem = {
      id: `custom-${Date.now()}`,
      name: customItemName,
      category: categoryToUse,
      rule: customItemRule,
      quantity: 1,
      weight: customItemWeight ? parseFloat(customItemWeight) : undefined,
      isDaily: false,
      checked: true,
    };
    setItems([...items, newItem]);
    setCustomItemName('');
    setCustomItemWeight('');

    trackEvent('custom_item_added', {
      name: newItem.name,
      category: newItem.category,
      rule: newItem.rule,
      weight: newItem.weight ?? null,
    });
  };
  
  const handleAddCustomRule = () => {
      if (!newRuleName.trim()) return;
      const newRule: CustomRuleDef = {
          id: `rule-${Date.now()}`,
          name: newRuleName,
          description: newRuleDesc,
          icon: newRuleIcon,
          behavior: newRuleBehavior,
          styleClass: newRuleColor
      };
      setCustomRuleDefs([...customRuleDefs, newRule]);
      setNewRuleName('');
      setNewRuleDesc('');
      setShowRuleManager(false);

      trackEvent('custom_rule_added', {
        name: newRule.name,
        behavior: newRule.behavior,
      });
  };

  const selectedItems = useMemo(
    () => items.filter(i => i.checked && i.quantity > 0),
    [items]
  );

  const riskReport = useMemo(
    () => analyzePackingRisks(selectedItems, customRuleById, { country: tripCountry, direction: tripDirection }),
    [selectedItems, customRuleById, tripCountry, tripDirection]
  );

  const countryNameByCode = useMemo(
    () => new Map(SUPPORTED_COUNTRIES.map(c => [c.code, c.name])),
    []
  );
  const directionNameByCode = useMemo(
    () => new Map(SUPPORTED_DIRECTIONS.map(d => [d.code, d.name])),
    []
  );
  const sortedRiskIssues = useMemo(() => [...riskReport.issues].sort(compareRiskIssues), [riskReport.issues]);
  const riskBannerCopy = useMemo(() => getRiskBannerCopy(riskCopyVariant), [riskCopyVariant]);
  const topBlockingIssue = useMemo(
    () => sortedRiskIssues.find((issue) => issue.blocking) || null,
    [sortedRiskIssues]
  );

  useEffect(() => {
    const prev = lastBlockingCountRef.current;
    const next = riskReport.summary.blocking;
    if (prev === null) {
      lastBlockingCountRef.current = next;
      return;
    }
    if (prev > 0 && next === 0) {
      trackEvent('risk_blocking_cleared', {
        destination,
        country: tripCountry,
        direction: tripDirection,
        rulesetVersion: RISK_RULESET_META.version,
      });
    }
    lastBlockingCountRef.current = next;
  }, [riskReport.summary.blocking, destination, tripCountry, tripDirection]);

  const handleFinish = () => {
    setRiskGateTouched(true);
    if (riskReport.summary.blocking > 0) {
      trackEvent('risk_gate_blocked', {
        destination,
        country: tripCountry,
        direction: tripDirection,
        rulesetVersion: RISK_RULESET_META.version,
        blocking: riskReport.summary.blocking,
        critical: riskReport.summary.critical,
        high: riskReport.summary.high,
      });
      const consequence = topBlockingIssue?.penalty ? `\n${topBlockingIssue.penalty}` : '';
      alert(`仍有 ${riskReport.summary.blocking} 個高風險項目未處理，請先修正後再完成。${consequence}`);
      return;
    }

    const finalizedItems = selectedItems
      .map(i => ({ id: i.id, quantity: i.quantity, category: i.category, rule: i.rule }));

    trackEvent('list_finalized', {
      destination,
      country: tripCountry,
      direction: tripDirection,
      rulesetVersion: RISK_RULESET_META.version,
      startDate: dates.start,
      endDate: dates.end,
      duration,
      items: finalizedItems,
      riskSummary: riskReport.summary,
    });

    setStep(2);
  };

  // Helper function to get visual config for rules
  const getRuleConfig = (rule: RuleType) => {
    return getGeneratorRuleConfig(rule, customRuleById);
  };

  // Derived items for display
  const displayItems = useMemo(() => {
    let result = items;

    // Filter
    if (activeCategory !== 'ALL') {
        result = result.filter(i => i.category === activeCategory);
    }

    const q = itemSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }

    // Sort
    if (sortBy !== 'default') {
        result = [...result].sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name, 'zh-TW');
            }
            if (sortBy === 'category') {
                const cats = Object.values(ItemCategory);
                return cats.indexOf(a.category) - cats.indexOf(b.category);
            }
            if (sortBy === 'rule') {
                // Simplified string comparison for rule sorting, could be improved
                return String(a.rule).localeCompare(String(b.rule));
            }
            if (sortBy === 'weight') {
                // Descending weight order (heaviest first)
                return (b.weight || 0) - (a.weight || 0);
            }
            return 0;
        });
    }
    return result;
  }, [items, activeCategory, itemSearch, sortBy]);

  useEffect(() => {
    if (!hydrateDoneRef.current) return;
    if (lastStepTrackedRef.current === step) return;
    lastStepTrackedRef.current = step;
    trackEvent('generator_step_viewed', { step });
  }, [step]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const queryValue = params.get('riskCopy');
    const stored = window.localStorage.getItem('tpa_risk_copy_variant');
    const resolved = resolveRiskCopyVariant({ queryValue, storedValue: stored });
    setRiskCopyVariant(resolved as 'serious' | 'friendly');
    window.localStorage.setItem('tpa_risk_copy_variant', resolved);
  }, []);

  const handleRiskCopyVariantChange = (variant: 'serious' | 'friendly') => {
    setRiskCopyVariant(variant);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tpa_risk_copy_variant', variant);
    }
    trackEvent('risk_copy_variant_changed', { variant });
  };

  useEffect(() => {
    if (!hydrateDoneRef.current) return;
    if (typeof window === 'undefined') return;

    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      const q = itemSearch.trim();
      if (!q) return;
      if (displayItems.length > 0) return;

      const key = `edit|${activeCategory}|${q.toLowerCase()}`;
      if (noResultSearchRef.current === key) return;
      noResultSearchRef.current = key;

      trackEvent('search_no_results', {
        area: 'edit',
        category: activeCategory,
        query: q,
      });
    }, 600);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [activeCategory, displayItems.length, itemSearch]);

  const filteredSelectedCount = useMemo(() => {
    return displayItems.filter(i => i.checked && i.quantity > 0).length;
  }, [displayItems]);

  const handleBulkSetChecked = (checked: boolean) => {
    const q = itemSearch.trim().toLowerCase();
    setItems(prev => {
      const next = prev.map(item => {
        if (activeCategory !== 'ALL' && item.category !== activeCategory) return item;
        if (q && !item.name.toLowerCase().includes(q)) return item;
        if (checked) {
          const nextQuantity = item.quantity > 0 ? item.quantity : 1;
          return { ...item, checked: true, quantity: nextQuantity };
        }
        return { ...item, checked: false };
      });
      return next;
    });

    trackEvent('items_bulk_checked_set', {
      checked,
      category: activeCategory,
      query: itemSearch.trim() || null,
    });
  };

  const handleTemplatePick = (templateId: string) => {
    setSelectedTemplateId(prev => {
      const next = prev === templateId ? '' : templateId;
      if (next) trackEvent('template_selected', { templateId: next });
      else trackEvent('template_cleared', { templateId });
      return next;
    });
  };

  // Step 0: Input Form (Rich UI)
  if (step === 0) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        {listIndex.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold text-slate-700">最近清單</div>
              <button
                onClick={resetToNewTrip}
                className="text-xs font-bold text-slate-500 hover:text-blue-600"
              >
                新建
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {listIndex.slice(0, 3).map(entry => (
                <button
                  key={entry.id}
                  onClick={() => handleOpenRecentList(entry.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-list-check"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 truncate">{entry.destination}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {entry.startDate} → {entry.endDate} • {entry.duration} 天
                    </div>
                  </div>
                  <div className="text-slate-300">
                    <i className="fa-solid fa-chevron-right"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
            
            {/* Hero Header */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <i className="fa-solid fa-earth-asia text-9xl absolute -top-4 -left-4"></i>
                    <i className="fa-solid fa-plane text-8xl absolute bottom-4 right-4 transform rotate-[-20deg]"></i>
                </div>
                
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/30">
                        <i className="fa-solid fa-suitcase-rolling text-3xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">準備好出發了嗎？</h2>
                    <p className="text-blue-100 mt-2 text-sm font-light">輸入目的地與日期，立即生成您的專屬清單</p>
                </div>
            </div>

            {/* Form Body */}
            <div className="p-8 space-y-8">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">旅程模板 Templates</label>
                        {selectedTemplateId && (
                          <button
                            onClick={() => handleTemplatePick(selectedTemplateId)}
                            className="text-xs font-bold text-slate-500 hover:text-blue-600"
                          >
                            清除
                          </button>
                        )}
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {TRIP_TEMPLATES.map(t => {
                          const active = selectedTemplateId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleTemplatePick(t.id)}
                              className={`flex-shrink-0 w-44 rounded-2xl border px-4 py-3 text-left transition shadow-sm hover:shadow ${active ? 'bg-slate-900 text-white border-slate-900' : `${t.style} hover:-translate-y-0.5`}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-white/15 text-white' : 'bg-white/60 text-slate-700'}`}>
                                  <i className={`fa-solid ${t.icon}`}></i>
                                </span>
                                <div className="min-w-0">
                                  <div className={`font-black truncate ${active ? 'text-white' : 'text-slate-900'}`}>{t.name}</div>
                                  <div className={`text-xs mt-0.5 truncate ${active ? 'text-white/70' : 'text-slate-600'}`}>{t.tagline}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                </div>

                {/* Destination Input */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">適用規則 Scope</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={tripCountry}
                        onChange={(e) => setTripCountry(e.target.value as 'JP' | 'KR' | 'SG' | 'VN' | 'TH')}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      >
                        {SUPPORTED_COUNTRIES.map(c => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={tripDirection}
                        onChange={(e) => setTripDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                      >
                        {SUPPORTED_DIRECTIONS.map(d => (
                          <option key={d.code} value={d.code}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">目的地 Destination</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                            <i className="fa-solid fa-location-dot text-lg"></i>
                        </div>
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 pl-12 pr-4 text-lg font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                            placeholder="例如：東京, 日本"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                        />
                    </div>
                </div>
                
                {/* Date Range Input */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                        <span>日期 Dates</span>
                        {duration > 0 && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                共 {duration} 天
                            </span>
                        )}
                    </label>
                    
                    <div className="flex flex-col sm:flex-row border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                        {/* Start Date */}
                        <div className="flex-1 relative border-b sm:border-b-0 sm:border-r border-slate-200 p-3 hover:bg-white transition-colors focus-within:bg-white group">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 group-focus-within:text-blue-500">去程 CHECK-IN</label>
                            <input 
                                type="date" 
                                className="w-full bg-transparent outline-none text-slate-800 font-semibold font-mono"
                                value={dates.start}
                                onChange={(e) => setDates(p => ({...p, start: e.target.value}))}
                            />
                        </div>

                        {/* End Date */}
                        <div className="flex-1 relative p-3 hover:bg-white transition-colors focus-within:bg-white group">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1 group-focus-within:text-blue-500">回程 CHECK-OUT</label>
                            <input 
                                type="date" 
                                className="w-full bg-transparent outline-none text-slate-800 font-semibold font-mono"
                                min={dates.start}
                                value={dates.end}
                                onChange={(e) => setDates(p => ({...p, end: e.target.value}))}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[2, 3, 5, 7, 10].map(d => (
                        <button
                          key={d}
                          onClick={() => setDurationDays(d)}
                          className="px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 text-slate-600 bg-white hover:border-blue-300 hover:text-blue-700 transition"
                        >
                          {d} 天
                        </button>
                      ))}
                    </div>
                </div>

                {/* Generate Button */}
                <button 
                    onClick={handleStart}
                    className="w-full group relative overflow-hidden bg-slate-900 text-white rounded-xl py-4 font-bold text-lg shadow-lg shadow-slate-200 hover:shadow-slate-300 hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-sm"
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        建立行李清單 <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </span>
                    <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
            </div>
        </div>
        
        <div className="text-center mt-6 text-slate-400 text-sm">
             <i className="fa-solid fa-shield-cat mr-1"></i> 智慧分類 • 自動建議 • 風險提醒
        </div>
      </div>
    );
  }

  // Step 2: Result View
  if (step === 2) {
    return (
        <ResultView 
            items={selectedItems} 
            tripDetails={finalTripDetails} 
            onBack={() => setStep(1)} 
            onNewTrip={resetToNewTrip}
            onShare={handleShare}
            customRules={customRuleDefs} 
            tasks={tasks} // Pass lifted state
            setTasks={setTasks} // Pass setter
            packedItemIds={packedItemIds} // Pass lifted state
            setPackedItemIds={setPackedItemIds} // Pass setter
        />
    );
  }

  // Step 1: Customize List
  return (
    <div className="max-w-4xl mx-auto pb-36 md:pb-24">
       {/* Step 1 Header */}
       <div className="bg-white p-6 rounded-2xl shadow-lg shadow-slate-200/50 mb-6 sticky top-4 z-10 border border-slate-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">客製化您的清單</h2>
                <p className="text-sm text-slate-500">系統已為 {duration} 天的 {destination} 之旅預選物品</p>
                <div className="mt-2 text-xs text-slate-500 font-bold">
                  {SUPPORTED_COUNTRIES.find(c => c.code === tripCountry)?.name || tripCountry} ・
                  {SUPPORTED_DIRECTIONS.find(d => d.code === tripDirection)?.name || tripDirection}
                </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetToNewTrip}
                className="bg-white text-slate-700 px-4 py-3 rounded-xl font-bold border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition shadow-sm flex items-center justify-center gap-2"
              >
                新旅程 <i className="fa-solid fa-plus"></i>
              </button>
              <button 
                  onClick={handleFinish}
                  disabled={riskReport.summary.blocking > 0}
                  className={`hidden md:flex px-6 py-3 rounded-xl font-bold transition shadow-lg items-center justify-center gap-2 ${
                    riskReport.summary.blocking > 0
                      ? 'bg-slate-200 text-slate-400 shadow-slate-100 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
                  }`}
              >
                  {riskReport.summary.blocking > 0 ? `先排除高風險 (${riskReport.summary.blocking})` : '完成並歸類'} <i className="fa-solid fa-check-circle"></i>
              </button>
            </div>
	          </div>
          <div className="mb-5 rounded-2xl border border-rose-300 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-rose-800">
                  <i className="fa-solid fa-gavel mr-2" />
                  {riskBannerCopy.title}
                </div>
                <div className="mt-1 text-xs font-bold text-rose-700">
                  {riskBannerCopy.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {riskBannerCopy.badges.map((badge: string, idx: number) => (
                  <span
                    key={`${badge}-${idx}`}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                      idx === 0 ? 'bg-rose-700 text-white' : 'bg-red-700 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleRiskCopyVariantChange('serious')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                  riskCopyVariant === 'serious'
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'
                }`}
              >
                法規嚴肅版
              </button>
              <button
                onClick={() => handleRiskCopyVariantChange('friendly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${
                  riskCopyVariant === 'friendly'
                    ? 'border-rose-700 bg-rose-700 text-white'
                    : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'
                }`}
              >
                旅客易懂版
              </button>
            </div>
          </div>

	          <div
	            className={`mb-5 rounded-2xl border p-4 ${
              riskReport.summary.blocking > 0
                ? 'border-red-300 bg-red-50'
                : riskReport.summary.total > 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-300 bg-emerald-50'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className={`text-sm font-black ${riskReport.summary.blocking > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                  <i className="fa-solid fa-shield-halved mr-2"></i>出入境風險檢查
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  規則版本 {RISK_RULESET_META.version}（{RISK_RULESET_META.updatedAt}）・審核：{RISK_RULESET_META.reviewedBy}
                </div>
                <div className="text-[11px] text-slate-500">{RISK_RULESET_META.notes}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700">
                  Critical {riskReport.summary.critical}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                  High {riskReport.summary.high}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-700">
                  Medium {riskReport.summary.medium}
                </span>
              </div>
            </div>

            <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${
              riskReport.summary.blocking > 0
                ? 'border-red-200 bg-red-100/60 text-red-700'
                : 'border-emerald-200 bg-emerald-100/70 text-emerald-700'
            }`}>
              {riskReport.summary.blocking > 0
                ? `尚有 ${riskReport.summary.blocking} 個高風險項目，請先處理再完成。`
                : '高風險已清零，可安全完成歸類。'}
            </div>
            {riskReport.summary.blocking > 0 && (
              <div className="mt-2 text-xs font-semibold text-red-700">
                為什麼這很重要：高風險項目可能在安檢被沒收、延誤登機，嚴重時會有罰款或法律責任。
              </div>
            )}
            {riskReport.summary.blocking > 0 && topBlockingIssue?.penalty && (
              <div className="mt-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-black text-red-800">
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                最高風險可能後果：{topBlockingIssue.penalty.replace(/^可能後果：/, '')}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {riskReport.summary.blocking > 0 && (
                <button
                  onClick={resolveAllBlockingRisks}
                  className="text-xs font-black px-3 py-2 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-100 transition"
                >
                  一鍵處理全部高風險（自動套用建議）
                </button>
              )}
              {lastBulkResolveSnapshot && (
                <button
                  onClick={undoBulkRiskResolution}
                  className="text-xs font-black px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition"
                >
                  復原上一批處理
                </button>
              )}
            </div>

            {lastBulkResolveSnapshot && (
              <div className="mt-2 text-[11px] font-semibold text-slate-600">
                已自動處理 {lastBulkResolveCount} 筆高風險項目，如需可立即復原。
              </div>
            )}

            {sortedRiskIssues.length > 0 && (
              <div className="mt-3 space-y-2">
                {sortedRiskIssues.slice(0, 6).map((issue) => {
                  const issueKey = `${issue.itemId}-${issue.type}`;
                  const isExpanded = expandedRiskKey === issueKey;
                  const defaultAction = getDefaultRiskAction(issue);
                  const consequenceClass =
                    issue.consequenceLevel === 'LEGAL'
                      ? 'bg-rose-700 text-white'
                      : issue.consequenceLevel === 'FINE'
                        ? 'bg-red-700 text-white'
                        : issue.consequenceLevel === 'CONFISCATION'
                          ? 'bg-orange-200 text-orange-900'
                          : 'bg-amber-200 text-amber-900';
                  const cardClass =
                    issue.consequenceLevel === 'LEGAL'
                      ? 'border-rose-300 bg-rose-50/95 shadow-md shadow-rose-100'
                      : issue.consequenceLevel === 'FINE'
                        ? 'border-red-300 bg-red-50/95 shadow-md shadow-red-100'
                        : issue.consequenceLevel === 'CONFISCATION'
                          ? 'border-orange-300 bg-orange-50/90'
                          : 'border-amber-200 bg-amber-50/85';
                  const severityClass =
                    issue.severity === 'Critical'
                      ? 'bg-red-100 text-red-700'
                      : issue.severity === 'High'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-amber-100 text-amber-700';

                  return (
                    <div key={issueKey} className={`rounded-xl border px-3 py-2.5 ${cardClass}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${consequenceClass}`}>
                              {getConsequenceLabel(issue.consequenceLevel)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${severityClass}`}>
                              {issue.severity}
                            </span>
                            <span className="text-xs font-black text-slate-800 truncate">{issue.itemName}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">{issue.reason}</div>
                          <div className="mt-1 text-[11px] font-bold text-slate-700">建議：{issue.action}</div>
                          {issue.penalty && (
                            <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-black text-red-700">
                              可能後果：{issue.penalty.replace(/^可能後果：/, '')}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => resolveRiskIssue(issue, defaultAction)}
                            className="text-xs font-black px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            {defaultAction === 'MOVE_TO_CARRY_ON'
                              ? '改為手提'
                              : defaultAction === 'MOVE_TO_CHECKED'
                                ? '改為託運'
                                : '移除項目'}
                          </button>
                          <button
                            onClick={() => setExpandedRiskKey(isExpanded ? null : issueKey)}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          >
                            {isExpanded ? '收合' : '詳情'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500 space-y-1">
                          <div>規則 ID：{issue.ruleId}</div>
                          <div>命中詞：{issue.matchedKeyword || '-'}（{issue.matchedFrom === 'synonym' ? '同義詞' : '關鍵字'}）</div>
                          <div>依據：{issue.source}</div>
                          <div>後果等級：{getConsequenceLabel(issue.consequenceLevel)}</div>
                          <div>可能後果：{issue.penalty || '-'}</div>
                          <div>
                            適用：{(issue.appliesCountries || []).map((code: string) => countryNameByCode.get(code) || code).join('/')}
                            {' '}・方向：{(issue.appliesDirections || []).map((code: string) => directionNameByCode.get(code) || code).join('/')}
                          </div>
                          <div>更新：{issue.ruleUpdatedAt || '-'} ・信心值：{typeof issue.ruleConfidence === 'number' ? issue.ruleConfidence.toFixed(2) : '-'}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sortedRiskIssues.length > 6 && (
                  <div className="text-xs text-slate-500">尚有 {sortedRiskIssues.length - 6} 筆風險項目。</div>
                )}
              </div>
            )}

            {riskGateTouched && riskReport.summary.blocking > 0 && (
              <div className="mt-3 text-xs font-bold text-red-600">
                產品核心：先清除違規風險，再進入最終清單。
              </div>
            )}
          </div>
          
          {/* Sorting Options */}
          <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1 scrollbar-hide">
             <span className="text-xs font-bold text-slate-400 whitespace-nowrap">排序方式：</span>
             <button 
                onClick={() => setSortBy('default')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${sortBy === 'default' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
                預設
             </button>
             <button 
                onClick={() => setSortBy('name')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${sortBy === 'name' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
                名稱
             </button>
             <button 
                onClick={() => setSortBy('category')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${sortBy === 'category' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
                類別
             </button>
             <button 
                onClick={() => setSortBy('rule')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${sortBy === 'rule' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
                行李規則
             </button>
             <button 
                onClick={() => setSortBy('weight')} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${sortBy === 'weight' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
             >
                重量
             </button>
          </div>

          {/* Category Tabs (Pills) */}
          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide mask-linear-fade">
             <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${
                    activeCategory === 'ALL'
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500/20' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                }`}
             >
                <i className={`fa-solid fa-layer-group ${activeCategory === 'ALL' ? 'text-blue-600' : 'text-slate-400'}`}></i>
                全部
             </button>
            {Object.values(ItemCategory).map(cat => {
                let icon = '';
                switch(cat) {
                    case ItemCategory.CLOTHES: icon = 'fa-shirt'; break;
                    case ItemCategory.ELECTRONICS: icon = 'fa-plug'; break;
                    case ItemCategory.TOILETRIES: icon = 'fa-pump-soap'; break;
                    case ItemCategory.LIFESTYLE: icon = 'fa-umbrella'; break;
                    default: icon = 'fa-box';
                }

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${
                      activeCategory === cat 
                        ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500/20' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                    <i className={`fa-solid ${icon} ${activeCategory === cat ? 'text-blue-600' : 'text-slate-400'}`}></i>
                    {cat}
                  </button>
                );
            })}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                placeholder="搜尋物品（名稱）..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white"
              />
              {itemSearch.trim() && (
                <button
                  onClick={() => setItemSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="清除搜尋"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkSetChecked(true)}
                className="bg-white text-slate-700 px-4 py-3 rounded-xl font-bold border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition shadow-sm"
              >
                全選
              </button>
              <button
                onClick={() => handleBulkSetChecked(false)}
                className="bg-white text-slate-700 px-4 py-3 rounded-xl font-bold border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition shadow-sm"
              >
                全不選
              </button>
          </div>
        </div>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
          <button
            onClick={handleFinish}
            disabled={riskReport.summary.blocking > 0}
            className={`w-full px-5 py-3 rounded-xl font-black text-base transition shadow-lg flex items-center justify-center gap-2 ${
              riskReport.summary.blocking > 0
                ? 'bg-slate-200 text-slate-400 shadow-slate-100 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
            }`}
          >
            {riskReport.summary.blocking > 0 ? `先排除高風險 (${riskReport.summary.blocking})` : '完成並歸類'}
            <i className="fa-solid fa-check-circle"></i>
          </button>
        </div>

          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>顯示 {displayItems.length} 項 • 已選 {filteredSelectedCount} 項</span>
            {itemSearch.trim() && (
              <span className="text-slate-400">篩選中</span>
            )}
          </div>
       </div>

       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="divide-y divide-slate-50">
            {displayItems.length > 0 ? (
                displayItems.map(item => {
                const ruleConfig = getRuleConfig(item.rule);
                return (
                <div key={item.id} className={`flex items-center justify-between p-5 transition-colors ${item.checked ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => handleToggleCheck(item.id)}>
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 text-transparent'}`}>
                            <i className="fa-solid fa-check text-xs"></i>
                        </div>
                        <div className={item.checked ? 'opacity-100' : 'opacity-50'}>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800 text-lg">{item.name}</p>
                                {item.weight && (
                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                        <i className="fa-solid fa-weight-hanging text-[8px]"></i> {item.weight}kg
                                    </span>
                                )}
                                {activeCategory === 'ALL' && (
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {item.category}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1.5 w-fit mt-1 border ${ruleConfig.style}`}>
                                <i className={`fa-solid ${ruleConfig.icon}`}></i>
                                {ruleConfig.label}
                            </span>
                        </div>
                    </div>
                    
                    {item.checked && (
                        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-100">
                            <button 
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-blue-600 active:scale-95 transition"
                            >
                                <i className="fa-solid fa-minus text-xs"></i>
                            </button>
                            <span className="w-6 text-center font-bold text-slate-700">{item.quantity}</span>
                            <button 
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-slate-600 shadow-sm hover:text-blue-600 active:scale-95 transition"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                            </button>
                        </div>
                    )}
                </div>
            )})
           ) : (
               <div className="p-8 text-center text-slate-400">
                   此分類無物品
               </div>
           )}
          </div>
          
          {/* Add Custom Item & Rule Selection */}
          <div className="p-6 bg-slate-50/80 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                     <i className="fa-solid fa-plus absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                     <input 
                        type="text" 
                        placeholder={activeCategory === 'ALL' ? '新增物品 (歸類為雜項)...' : `新增物品到「${activeCategory}」...`}
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="w-full pl-10 p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomItem()}
                     />
                </div>
                <div className="flex gap-2">
                    <div className="relative w-20 sm:w-24 flex-shrink-0">
                         <input 
                            type="number" 
                            placeholder="0.0"
                            value={customItemWeight}
                            onChange={(e) => setCustomItemWeight(e.target.value)}
                            className="w-full p-3 pr-6 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 text-center"
                            min="0"
                            step="0.1"
                         />
                         <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">kg</span>
                    </div>

                    <select 
                        value={customItemRule as string}
                        onChange={(e) => setCustomItemRule(e.target.value as RuleType)}
                        className="p-3 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 outline-none focus:border-blue-500 max-w-[150px]"
                    >
                        <optgroup label="標準規則">
                            <option value={LuggageRule.FLEXIBLE_CHECKED}>習慣託運</option>
                            <option value={LuggageRule.FLEXIBLE_CARRY_ON}>習慣手提</option>
                            <option value={LuggageRule.STRICT_CARRY_ON}>強制手提</option>
                            <option value={LuggageRule.STRICT_CHECKED}>強制託運</option>
                        </optgroup>
                        {customRuleDefs.length > 0 && (
                            <optgroup label="自訂規則">
                                {customRuleDefs.map(rule => (
                                    <option key={rule.id} value={rule.id}>{rule.name}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    <button 
                        onClick={handleAddCustomItem}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md whitespace-nowrap"
                    >
                        新增
                    </button>
                </div>
            </div>
          </div>
       </div>

       {/* Custom Rule Manager Section */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
           <button 
                onClick={() => setShowRuleManager(!showRuleManager)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
           >
               <div className="flex items-center gap-2 text-slate-800 font-bold">
                   <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                       <i className="fa-solid fa-gear"></i>
                   </div>
                   管理自訂行李規則 (Advanced)
               </div>
               <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${showRuleManager ? 'rotate-180' : ''}`}></i>
           </button>

           {showRuleManager && (
               <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* New Rule Form */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-700 mb-4 text-sm">新增規則定義</h4>
                            <div className="space-y-3">
                                <input 
                                    type="text" 
                                    placeholder="規則名稱 (例如：易碎物品)"
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    value={newRuleName}
                                    onChange={(e) => setNewRuleName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <select 
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white flex-1"
                                        value={newRuleBehavior}
                                        onChange={(e) => setNewRuleBehavior(e.target.value as 'CARRY' | 'CHECK')}
                                    >
                                        <option value="CARRY">視為手提</option>
                                        <option value="CHECK">視為託運</option>
                                    </select>
                                    <select 
                                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white w-20 font-awesome"
                                        value={newRuleIcon}
                                        onChange={(e) => setNewRuleIcon(e.target.value)}
                                    >
                                        {availableIcons.map(i => (
                                            <option key={i.class} value={i.class}>{i.unicode} {i.label}</option> 
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {availableColors.map((col, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => setNewRuleColor(col.class)}
                                            className={`w-6 h-6 rounded-full border ${col.class.split(' ')[0]} ${newRuleColor === col.class ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                            title={col.label}
                                        ></button>
                                    ))}
                                </div>
                                <button 
                                    onClick={handleAddCustomRule}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 mt-2"
                                >
                                    建立規則
                                </button>
                            </div>
                        </div>

                        {/* Existing Custom Rules */}
                        <div>
                            <h4 className="font-bold text-slate-700 mb-4 text-sm">已建立的規則</h4>
                            {customRuleDefs.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">尚無自訂規則</p>
                            ) : (
                                <div className="space-y-2">
                                    {customRuleDefs.map(rule => (
                                        <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${rule.styleClass}`}>
                                            <i className={`fa-solid ${rule.icon}`}></i>
                                            <span className="font-bold flex-1">{rule.name}</span>
                                            <span className="text-[10px] uppercase bg-white/50 px-2 py-1 rounded">
                                                {rule.behavior === 'CARRY' ? '手提' : '託運'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-400">
                        <i className="fa-solid fa-circle-info mr-1"></i>
                        新增後，您可以在上方「新增物品」時選擇此規則。
                    </div>
               </div>
           )}
       </div>
    </div>
  );
};

export default GeneratorTab;
