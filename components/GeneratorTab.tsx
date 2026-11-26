
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { PackingItem, TripDetails, LuggageRule, ItemCategory, CustomRuleDef, RuleType, PreFlightTask } from '../types';
import { DEFAULT_DATABASE, PRE_FLIGHT_TASKS, TRIP_TEMPLATES } from '../constants';
import { RISK_RULESET_META, SUPPORTED_COUNTRIES, SUPPORTED_DIRECTIONS } from '../constants/riskKeywordRules.js';
import ResultView from './ResultView';
import { trackEvent } from '../services/analyticsService';
import { getDefaultTripDates, addCalendarDays, inclusiveCalendarDays } from '../utils/date';
import { buildCustomRuleById, getGeneratorRuleConfig } from '../utils/packingRules';
import { apiUrl } from '../services/apiBase';
import { analyzePackingRisks } from '../utils/riskEngine.js';
import { applyRiskResolution } from '../utils/riskActions.js';
import { compareRiskIssues, getConsequenceLabel } from '../utils/riskPriority.js';
import { getRiskBannerCopy, resolveRiskCopyVariant } from '../utils/riskBannerCopy.js';
import { buildRiskGatePrompt, buildSecurityGateChecklist, evaluateNewItemRiskGate } from '../utils/riskFlowEnhancements.js';
import { buildRiskGateReport, normalizeRiskMode } from '../utils/riskPolicy.js';
import {
  createEmptyListSnapshot,
  clearActiveListId,
  getActiveListId,
  ListIndexEntry,
  ListSnapshot,
  setActiveListId as persistActiveListId,
  touchTripDetailsKey,
} from '../services/listStorageService';
import { useCollabSession } from '../hooks/useCollabSession';
import { CLOUD_FEATURES_ENABLED } from '../services/featureFlags';
import { listRepository } from '../infrastructure/listRepository';
import GuardianPanel from './GuardianPanel';
import JourneyOverview from './JourneyOverview';
import TripExpenses from './TripExpenses';
import EmergencyCard from './EmergencyCard';
import type { ReceiptRequest } from '../domain/receiptText';
import { migrateExpenseItems, needsBorderReview, type CrossBorderItem, type Expense, type ExchangeRate } from '../domain/expenses';
import PackingItemIcon from './PackingItemIcon';
import TripDocuments from './TripDocuments';
import TripDisruptions from './TripDisruptions';
import TransportPlans from './TransportPlans';
import TravelProtectionPanel from './TravelProtection';
import type { TripDocument } from '../domain/tripDocuments';
import type { TripDisruption } from '../domain/tripDisruptions';
import type { TransportPlan } from '../domain/transportPlan';
import type { TravelProtection } from '../domain/travelProtection';
import { emptyGuardian, initialRules, markChangedRules, markDocumentChanges, markScheduleChanges, type GuardianState } from '../domain/guardian';
import { isValidTimeZone } from '../domain/timezone';

type Props = { registerFlush: (flush: (() => Promise<void>) | null) => void; onStorageError: (message: string) => void; expenses: Expense[]; crossBorderItems: CrossBorderItem[]; exchangeRates: ExchangeRate[]; onShoppingChange: (expenses: Expense[], items: CrossBorderItem[]) => void; onRatesChange: (rates: ExchangeRate[]) => void; onCountryChange: (country: string) => void; onNavigateToShopping?: () => void; receiptRequest?: ReceiptRequest | null; onReceiptRequestHandled?: () => void };
const GeneratorTab: React.FC<Props> = ({ registerFlush, onStorageError, expenses, crossBorderItems, exchangeRates, onShoppingChange, onRatesChange, onCountryChange, onNavigateToShopping, receiptRequest, onReceiptRequestHandled }) => {
  const [step, setStep] = useState<number>(0); // 0: Input, 1: Customize, 2: Result
  const [journeySection, setJourneySection] = useState<'overview' | 'packing'>('overview');
  const [expenseReceipt, setExpenseReceipt] = useState<ReceiptRequest | null>(null);
  const [disruptionOpenRequest, setDisruptionOpenRequest] = useState(0);
  const [startError, setStartError] = useState<{field:'destination'|'start'|'end'; message:string} | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const tripSettingsRef = useRef<HTMLDetailsElement>(null);

  const [listIndex, setListIndex] = useState<ListIndexEntry[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const hydrateDoneRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');
  const lastStepTrackedRef = useRef<number | null>(null);
  const lastBlockingCountRef = useRef<number | null>(null);
  const noResultSearchRef = useRef<string>('');
  const searchTimerRef = useRef<number | null>(null);

  // Step 0 Form State
  const [destination, setDestination] = useState('');
  const [tripCountry, setTripCountryRaw] = useState<'JP' | 'KR' | 'SG' | 'VN' | 'TH'>('JP');
  const setTripCountry = useCallback((country: 'JP' | 'KR' | 'SG' | 'VN' | 'TH') => { setTripCountryRaw(country); onCountryChange(country); }, [onCountryChange]);
  const [tripDirection, setTripDirection] = useState<'OUTBOUND' | 'INBOUND'>('OUTBOUND');

  const [dates, setDates] = useState(() => getDefaultTripDates());
  const [dateDraft, setDateDraft] = useState(() => getDefaultTripDates());
  const [dateNotice, setDateNotice] = useState('');
  const [departureTimezone, setDepartureTimezone] = useState('');
  const [returnTimezone, setReturnTimezone] = useState('');
  const [timezoneDraft, setTimezoneDraft] = useState({departure:'',return:''});

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
    const end = addCalendarDays(dates.start, Math.max(0, days - 1));
    if (!end) return;
    setDates(prev => ({ ...prev, end }));
    trackEvent('quick_duration_set', { days });
  };

  // Derived Duration
  const duration = useMemo(() => {
    return inclusiveCalendarDays(dates.start, dates.end);
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
  const [guardian, setGuardian] = useState<GuardianState>(emptyGuardian);
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [disruptions, setDisruptions] = useState<TripDisruption[]>([]);
  const [transportPlans, setTransportPlans] = useState<TransportPlan[]>([]);
  const [travelProtection, setTravelProtection] = useState<TravelProtection|undefined>(undefined);
  const [luggageWeights, setLuggageWeights] = useState<ListSnapshot['luggageWeights']>(undefined);

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
  const [riskMode, setRiskMode] = useState<'standard' | 'conservative'>('conservative');
  const [expandedRiskKey, setExpandedRiskKey] = useState<string | null>(null);
  const [focusedRiskItemId, setFocusedRiskItemId] = useState<string | null>(null);
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

  const handleStart = async () => {
    if (creatingRef.current) return;
    if (!destination.trim()) {
      setStartError({field:'destination',message:'請先輸入目的地。'});
      document.getElementById('trip-destination')?.focus();
      return;
    }
    if (!dates.start) {
      setStartError({field:'start',message:'請先選擇出發日期。'});
      document.getElementById('trip-start')?.focus();
      return;
    }
    if (!dates.end || duration <= 0) {
      setStartError({field:'end',message:!dates.end ? '請先選擇回程日期。' : '回程日期不能早於出發日期。'});
      document.getElementById('trip-end')?.focus();
      return;
    }
    setStartError(null);
    creatingRef.current = true;
    setCreating(true);

    const trip = {
      destination: destination.trim(),
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

    // Initialize list based on days if items empty (first run), or preserve existing selection if just updating details?
    // For simplicity, if items are empty, load default. If user goes back to input, we probably want to keep their items.
    const baseItems: PackingItem[] = DEFAULT_DATABASE.map(item => ({
      ...item,
      quantity: item.isDaily ? duration : 1,
      checked: item.id !== 'e8' && item.id !== 'e10',
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
    setGuardian(emptyGuardian());
    setDocuments([]);
    setDisruptions([]);
    setTransportPlans([]);
    setTravelProtection(undefined);
    onShoppingChange([],[]);
    onRatesChange([]);
    setLuggageWeights(undefined);
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

    setDateDraft({start: dates.start, end: dates.end});
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
    try {
      touchTripDetailsKey(trip);
      await listRepository.save(snapshot);
      persistActiveListId(snapshot.id);
      setActiveListId(snapshot.id);
      setListIndex(toIndex(await listRepository.getAll()));
      setStep(1);
      setDestination(trip.destination);
      setJourneySection('overview');
      window.scrollTo({ top: 0 });
      onStorageError('');
    } catch { onStorageError('清單無法儲存，請檢查瀏覽器儲存空間。資料尚未保存，請勿關閉頁面。'); }
    finally { creatingRef.current = false; setCreating(false); }
  };

  const resetToNewTrip = async () => {
    try { await flushCurrent(); clearActiveListId(); } catch { onStorageError('無法切換旅程，請檢查瀏覽器儲存狀態。'); return; }
    setActiveListId(null);
    setStep(0);
    setJourneySection('overview');
    setDestination('');
    setTripCountry('JP');
    setTripDirection('OUTBOUND');
    const nextDates = getDefaultTripDates();
    setDates(nextDates);
    setDateDraft(nextDates);
    setDateNotice('');
    setDepartureTimezone(''); setReturnTimezone(''); setTimezoneDraft({departure:'',return:''});
    setFinalTripDetails({ destination: '', startDate: '', duration: 0, country: 'JP', direction: 'OUTBOUND' });
    setItems([]);
    setGuardian(emptyGuardian());
    setDocuments([]);
    setDisruptions([]);
    setTransportPlans([]);
    setTravelProtection(undefined);
    onShoppingChange([],[]);
    onRatesChange([]);
    setLuggageWeights(undefined);
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
    setDateDraft({ start: snapshot.trip.startDate, end: snapshot.trip.endDate });
    setDateNotice('');
    setDepartureTimezone(snapshot.trip.departureTimezone ?? '');
    setReturnTimezone(snapshot.trip.returnTimezone ?? '');
    setTimezoneDraft({departure:snapshot.trip.departureTimezone ?? '', return:snapshot.trip.returnTimezone ?? ''});
    setFinalTripDetails({
      destination: snapshot.trip.destination,
      startDate: snapshot.trip.startDate,
      duration: snapshot.trip.duration,
      country: snapshot.trip.country || 'JP',
      direction: snapshot.trip.direction || 'OUTBOUND',
    });
    setItems(snapshot.items);
    setGuardian(markChangedRules(snapshot.guardian ?? emptyGuardian(), initialRules));
    setDocuments(snapshot.documents ?? []);
    setDisruptions(snapshot.disruptions ?? []);
    setTransportPlans(snapshot.transportPlans ?? []);
    setTravelProtection(snapshot.travelProtection);
    const migrated = migrateExpenseItems(snapshot.expenses ?? [],snapshot.crossBorderItems);
    onShoppingChange(migrated.expenses, migrated.items);
    onRatesChange(snapshot.exchangeRates ?? []);
    onCountryChange(snapshot.trip.country || 'JP');
    setLuggageWeights(snapshot.luggageWeights);
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
        departureTimezone,
        returnTimezone,
      },
      items,
      tasks,
      packedItemIds: Array.from(packedItemIds),
      customRules: customRuleDefs,
      guardian,
      documents,
      disruptions,
      transportPlans,
      expenses,
      crossBorderItems,
      exchangeRates,
      ...(travelProtection ? {travelProtection} : {}),
      ...(luggageWeights ? {luggageWeights} : {}),
    };
  };

  const toIndex = (lists: ListSnapshot[]): ListIndexEntry[] => lists
    .map(({ id, updatedAt, trip }) => ({ id, updatedAt, ...trip }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const latestSnapshot = useRef<ListSnapshot | null>(null);
  latestSnapshot.current = activeListId ? buildSnapshot(activeListId, new Date().toISOString()) : null;
  const flushCurrent = async () => {
    if (saveTimerRef.current !== null) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (saveInFlightRef.current) return saveInFlightRef.current;
    if (!hydrateDoneRef.current || !latestSnapshot.current || !dirtyRef.current) return;
    const pending = (async () => {
      try {
        while (dirtyRef.current && latestSnapshot.current) {
          const revision = revisionRef.current;
          const snapshot = latestSnapshot.current;
          await listRepository.save(snapshot);
          if (revisionRef.current === revision) dirtyRef.current = false;
        }
        setSaveStatus('saved');
        onStorageError('');
      } catch (error) {
        setSaveStatus('error');
        onStorageError('清單儲存失敗，請檢查瀏覽器儲存空間。請保留此頁並重試。');
        throw error;
      }
    })();
    saveInFlightRef.current = pending;
    try { await pending; } finally { if (saveInFlightRef.current === pending) saveInFlightRef.current = null; }
  };
  const flushRef = useRef(flushCurrent);
  flushRef.current = flushCurrent;
  useEffect(() => { registerFlush(() => flushRef.current()); return () => registerFlush(null); }, [registerFlush]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const onVisibility = () => { if (document.visibilityState === 'hidden' && dirtyRef.current) void flushRef.current().catch(() => undefined); };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);


  useEffect(() => {
    if (!receiptRequest || !activeListId || step === 0) return;
    setStep(1);
    setJourneySection('overview');
    setExpenseReceipt(receiptRequest);
    onReceiptRequestHandled?.();
  }, [receiptRequest, activeListId, step]);

  const handleOpenRecentList = async (id: string) => {
    try {
      await flushCurrent();
      const snapshot = await listRepository.get(id);
      if (!snapshot) throw new Error('清單不存在');
      persistActiveListId(id);
      applySnapshot(snapshot);
      setListIndex(toIndex(await listRepository.getAll()));
    } catch { onStorageError('無法開啟清單，請確認本機資料是否可用。'); }
  };

  const handleShare = async (): Promise<{ url: string | null; reason?: string; status?: number }> => {
    if (!CLOUD_FEATURES_ENABLED) return { url: null, reason: 'unavailable' };
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
    let cancelled = false;
    (async () => {
      try {
        const lists = await listRepository.getAll();
        if (cancelled) return;
        const index = toIndex(lists);
        setListIndex(index);
        const preferred = getActiveListId();
        const snapshot = lists.find(x => x.id === preferred) ?? lists.find(x => x.id === index[0]?.id);
        if (snapshot) {
          // A restored or fallback list must also become the active list for calendar export.
          persistActiveListId(snapshot.id);
          applySnapshot(snapshot);
        }
        hydrateDoneRef.current = true;
      } catch { if (!cancelled) onStorageError('無法讀取本機清單，請保留備份並重新開啟。'); }
    })();
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!hydrateDoneRef.current || !activeListId) return;
    revisionRef.current += 1;
    dirtyRef.current = true;
    setSaveStatus('saving');
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushRef.current().then(async () => setListIndex(toIndex(await listRepository.getAll()))).catch(() => undefined);
    }, 500);
    return () => { if (saveTimerRef.current !== null) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; } };
  }, [activeListId, activeCategory, customRuleDefs, dates.end, dates.start, destination, tripCountry, tripDirection, duration, items, packedItemIds, sortBy, step, tasks, guardian, documents, disruptions, transportPlans, travelProtection, expenses, crossBorderItems, exchangeRates, luggageWeights, departureTimezone, returnTimezone]);

  const currentSnapshotForCollab = useMemo(() => {
    if (!activeListId) return null;
    return buildSnapshot(activeListId, new Date().toISOString());
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
    buildSnapshot // Added as dependency if it relies on scope, but it's defined in component scope
  ]);



  const applySnapshotRef = useRef(applySnapshot);
  useEffect(() => { applySnapshotRef.current = applySnapshot; });

  const onRemoteUpdateStable = useCallback((s: ListSnapshot) => {
    applySnapshotRef.current(s);
  }, []);

  const { sessionId: collabSessionId, startCollab, isSyncing } = useCollabSession(
    currentSnapshotForCollab,
    onRemoteUpdateStable
  );

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

  const handleRemoveItem = (id: string, name: string) => {
    if (!window.confirm(`確定從這趟旅程刪除「${name}」？`)) return;
    setLastBulkResolveSnapshot(null);
    setLastBulkResolveCount(0);
    setItems(prev => prev.filter(item => item.id !== id));
    setPackedItemIds(prev => { const next = new Set(prev); next.delete(id); return next; });
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
    const blockingIssues = riskGateReport.blockingIssues;
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
      mode: riskMode,
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

    const gate = evaluateNewItemRiskGate(
      newItem,
      customRuleById,
      { country: tripCountry, direction: tripDirection },
      riskMode
    );
    if (gate.shouldBlock && gate.issue && typeof window !== 'undefined') {
      trackEvent('risk_add_intercept_shown', {
        itemName: newItem.name,
        type: gate.issue.type,
        consequenceLevel: gate.issue.consequenceLevel,
        mode: riskMode,
      });
      const proceed = window.confirm(buildRiskGatePrompt(gate.issue));
      if (!proceed) {
        trackEvent('risk_add_intercept_blocked', {
          itemName: newItem.name,
          type: gate.issue.type,
          consequenceLevel: gate.issue.consequenceLevel,
          mode: riskMode,
        });
        return;
      }
      trackEvent('risk_add_intercept_overridden', {
        itemName: newItem.name,
        type: gate.issue.type,
        consequenceLevel: gate.issue.consequenceLevel,
        mode: riskMode,
      });
    }

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
  const riskGateReport = useMemo(
    () => buildRiskGateReport(riskReport.issues, riskMode),
    [riskReport.issues, riskMode]
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
    () => riskGateReport.blockingIssues[0] || null,
    [riskGateReport.blockingIssues]
  );
  const securityGateChecklist = useMemo(
    () => buildSecurityGateChecklist(riskGateReport.blockingIssues, 5),
    [riskGateReport.blockingIssues]
  );
  const riskModeGuidance = useMemo(() => {
    if (riskMode === 'conservative') {
      return {
        title: '目前模式：保守清零（Critical + High）',
        description: '系統會把 Critical 與 High 都視為必處理，較符合「風險清零」目標。',
        panelClass: 'border-rose-200 bg-rose-100/60 text-rose-800',
      };
    }
    return {
      title: '目前模式：一般（僅擋 Critical）',
      description: '流程只會強制攔截 Critical；High 風險需由你自行判斷是否先處理。',
      panelClass: 'border-amber-300 bg-amber-100/70 text-amber-900',
    };
  }, [riskMode]);

  useEffect(() => {
    const prev = lastBlockingCountRef.current;
    const next = riskGateReport.blocking;
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
  }, [riskGateReport.blocking, destination, tripCountry, tripDirection]);

  const handleFinish = () => {
    setRiskGateTouched(true);
    if (riskGateReport.blocking > 0) {
      trackEvent('risk_gate_blocked', {
        destination,
        mode: riskMode,
        country: tripCountry,
        direction: tripDirection,
        rulesetVersion: RISK_RULESET_META.version,
        blocking: riskGateReport.blocking,
        critical: riskGateReport.critical,
        high: riskGateReport.high,
      });
      const consequence = topBlockingIssue?.penalty ? `\n${topBlockingIssue.penalty}` : '';
      alert(`仍有 ${riskGateReport.blocking} 個高風險項目未處理，請先修正後再完成。${consequence}`);
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

  const handleFocusRiskItem = (itemId: string) => {
    setActiveCategory('ALL');
    setItemSearch('');
    setFocusedRiskItemId(itemId);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const target = document.getElementById(`item-row-${itemId}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      window.setTimeout(() => setFocusedRiskItemId(null), 1800);
    }
    trackEvent('risk_checklist_focus_item', { itemId });
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

    const modeQuery = params.get('riskMode');
    const modeStored = window.localStorage.getItem('tpa_risk_mode');
    const resolvedMode = normalizeRiskMode(modeQuery || modeStored || 'conservative');
    setRiskMode(resolvedMode as 'standard' | 'conservative');
    window.localStorage.setItem('tpa_risk_mode', resolvedMode);
  }, []);

  const handleRiskCopyVariantChange = (variant: 'serious' | 'friendly') => {
    setRiskCopyVariant(variant);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tpa_risk_copy_variant', variant);
    }
    trackEvent('risk_copy_variant_changed', { variant });
  };

  const handleRiskModeChange = (mode: 'standard' | 'conservative') => {
    const normalized = normalizeRiskMode(mode) as 'standard' | 'conservative';
    setRiskMode(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tpa_risk_mode', normalized);
    }
    trackEvent('risk_mode_changed', { mode: normalized });
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
      <div className="new-trip max-w-lg mx-auto">
        {receiptRequest && <div role="status" className="receipt-pending">{receiptRequest.text ? '已收到分享的收據文字。' : ''}請先選擇或建立旅程，接著會自動打開記帳。</div>}
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
              {listIndex.map(entry => (
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

        <div className="new-trip-card overflow-hidden">

          {/* Hero Header */}
          <div className="new-trip-hero relative overflow-hidden">
            <img className="new-trip-illustration" src="/travel-landscape.svg" alt="" aria-hidden="true" />
            <div className="new-trip-stamp" aria-hidden="true"><i className="fa-solid fa-plane"></i></div>
            <p className="eyebrow">出發前的準備</p>
            <h2>下一趟旅行，<br />慢慢準備。</h2>
            <p className="new-trip-intro">把行李、出發前的準備和旅途中的重要事項，放在同一個地方。</p>
            <div className="hero-route" aria-hidden="true"><span>出發</span><i></i><i className="fa-solid fa-location-dot"></i><span>抵達</span></div>
          </div>

          {/* Form Body */}
          <div className="new-trip-form">
            <details className="trip-template trip-option"><summary>旅程類型 <span>{TRIP_TEMPLATES.find(t => t.id === selectedTemplateId)?.name || '可選擇'}</span></summary><div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">旅程類型</label>
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
            </div></details>

            {/* Destination Input */}
            <details className="trip-scope trip-option"><summary>參考地區與方向 <span>{SUPPORTED_COUNTRIES.find(c => c.code === tripCountry)?.name}・{SUPPORTED_DIRECTIONS.find(d => d.code === tripDirection)?.name}</span></summary><div className="space-y-2 mt-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">旅程方向與參考地區</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  aria-label="適用規則國家"
                  value={tripCountry}
                  onChange={(e) => setTripCountry(e.target.value as 'JP' | 'KR' | 'SG' | 'VN' | 'TH')}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                >
                  {SUPPORTED_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <select
                  aria-label="旅程方向"
                  value={tripDirection}
                  onChange={(e) => setTripDirection(e.target.value as 'OUTBOUND' | 'INBOUND')}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 px-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                >
                  {SUPPORTED_DIRECTIONS.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div></details>

            <div className="trip-destination space-y-2">
              <label htmlFor="trip-destination" className="text-xs font-bold text-slate-400 uppercase tracking-wider">目的地</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <i className="fa-solid fa-location-dot text-lg"></i>
                </div>
                <input
                  id="trip-destination"
                  type="text"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 pl-12 pr-4 text-lg font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  placeholder="例如：東京, 日本"
                  value={destination}
                  aria-invalid={startError?.field === 'destination'}
                  aria-describedby={startError?.field === 'destination' ? 'destination-error' : undefined}
                  onChange={(e) => { setDestination(e.target.value); if (startError?.field === 'destination') setStartError(null); }}
                />
              </div>
              {startError?.field === 'destination' && <p id="destination-error" role="alert" className="form-error">{startError.message}</p>}
            </div>

            {/* Date Range Input */}
            <div className="trip-dates space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span>旅行日期</span>
                {duration > 0 && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    共 {duration} 天
                  </span>
                )}
              </label>

              <div className="flex flex-col sm:flex-row border-2 border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                {/* Start Date */}
                <div className="flex-1 relative border-b sm:border-b-0 sm:border-r border-slate-200 p-3 hover:bg-white transition-colors focus-within:bg-white group">
                  <label htmlFor="trip-start" className="block text-[10px] font-bold text-slate-400 mb-1 group-focus-within:text-blue-500">出發日期</label>
                  <input
                    id="trip-start"
                    type="date"
                    className="w-full bg-transparent outline-none text-slate-800 font-semibold font-mono"
                    value={dates.start}
                    aria-invalid={startError?.field === 'start'}
                    aria-describedby={startError?.field === 'start' ? 'start-error' : undefined}
                    onChange={(e) => { setDates(p => ({ ...p, start: e.target.value })); if (startError?.field === 'start') setStartError(null); }}
                  />
                  {startError?.field === 'start' && <p id="start-error" role="alert" className="form-error">{startError.message}</p>}
                </div>

                {/* End Date */}
                <div className="flex-1 relative p-3 hover:bg-white transition-colors focus-within:bg-white group">
                  <label htmlFor="trip-end" className="block text-[10px] font-bold text-slate-400 mb-1 group-focus-within:text-blue-500">回程日期</label>
                  <input
                    id="trip-end"
                    type="date"
                    className="w-full bg-transparent outline-none text-slate-800 font-semibold font-mono"
                    min={dates.start}
                    value={dates.end}
                    aria-invalid={startError?.field === 'end'}
                    aria-describedby={startError?.field === 'end' ? 'end-error' : undefined}
                    onChange={(e) => { setDates(p => ({ ...p, end: e.target.value })); if (startError?.field === 'end') setStartError(null); }}
                  />
                  {startError?.field === 'end' && <p id="end-error" role="alert" className="form-error">{startError.message}</p>}
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
            <p className="trip-scope-notice">清單參考：{SUPPORTED_COUNTRIES.find(c => c.code === tripCountry)?.name}・{SUPPORTED_DIRECTIONS.find(d => d.code === tripDirection)?.name}。與行程不符時請先調整；其他地區請查詢官方規定。</p>
            <button
              onClick={handleStart}
              disabled={creating}
              aria-busy={creating}
              className="trip-start-button w-full group relative overflow-hidden rounded-xl py-4 font-bold text-lg transition-all"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {creating ? '正在建立旅程…' : '建立旅程'} <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform" aria-hidden="true"></i>
              </span>
              <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-slate-500 text-sm">
          <i className="fa-solid fa-lock mr-1"></i> 旅程資料保存在這個瀏覽器
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
        onBack={() => { setJourneySection('packing'); setStep(1); }}
        onGuardian={() => { setJourneySection('overview'); setStep(1); window.scrollTo({top:0}); }}
        onItemChange={(id, update) => setItems(prev=>prev.map(item=>item.id===id?{...item,...update}:item))}
        luggageWeights={luggageWeights}
        onWeightChange={setLuggageWeights}
        saveStatus={saveStatus}
        onNewTrip={resetToNewTrip}
        onShare={handleShare}
        customRules={customRuleDefs}
        tasks={tasks} // Pass lifted state
        setTasks={setTasks} // Pass setter
        packedItemIds={packedItemIds} // Pass lifted state
        setPackedItemIds={setPackedItemIds} // Pass setter
        collabSessionId={collabSessionId}
        onStartCollab={startCollab}
        isSyncing={isSyncing}
      />
    );
  }

  // Step 1: Customize List
  const flights = documents.filter(doc => doc.kind === 'flight');
  const stays = documents.filter(doc => doc.kind === 'lodging');
  const onlyFlight = flights.length === 1 ? flights[0] : undefined;

  return (
    <div className="journey-workspace max-w-4xl mx-auto pb-36 md:pb-24">
      <div className="journey-ticket">
        <div className="journey-ticket-top"><span>我的旅程</span><span><i className="fa-solid fa-plane" aria-hidden="true"></i> {duration} 天</span></div>
        <h2>{destination || '我的旅程'}</h2>
        <p>{dates.start || '日期待定'} <span aria-hidden="true">→</span> {dates.end || '日期待定'}</p>
        <div className="journey-ticket-bottom"><span>出發前的準備，都在這裡。</span><i className="fa-regular fa-sun" aria-hidden="true"></i></div>
      </div>
      <div className="journey-nav" aria-label="旅程準備內容">
        <button type="button" aria-pressed={journeySection === 'overview'} onClick={() => setJourneySection('overview')}><i className="fa-regular fa-compass" aria-hidden="true"></i> 旅程守護</button>
        <button type="button" aria-pressed={journeySection === 'packing'} onClick={() => setJourneySection('packing')}><i className="fa-solid fa-suitcase-rolling" aria-hidden="true"></i> 行李清單 <span>{selectedItems.length}</span></button>
      </div>
      <div className="journey-meta"><p role="status" aria-live="polite" className="save-indicator">{saveStatus === 'saving' ? '正在儲存至本機…' : saveStatus === 'error' ? '本機儲存失敗，請保留此頁。' : '已儲存至本機'}</p><button type="button" onClick={() => void resetToNewTrip()}>切換／新增旅程</button></div>
      <div hidden={journeySection !== 'overview'}>
      <JourneyOverview borderReviewCount={crossBorderItems.filter(needsBorderReview).length} weights={luggageWeights} documents={documents} protection={travelProtection} onNavigate={area => {
        if (area === 'shopping') { onNavigateToShopping?.(); return; }
        if (area === 'packing') { setJourneySection('packing'); handleFinish(); window.scrollTo({top:0}); return; }
        if (area === 'disruptions') setDisruptionOpenRequest(value => value + 1);
        const target = document.getElementById(`journey-${area}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target?.focus({ preventScroll: true });
      }} />
      <details ref={tripSettingsRef} className="trip-settings mb-6"><summary className="cursor-pointer font-bold">變更旅程日期與時區</summary>
        <p className="text-sm mt-2">按「更新日期與時區」後才會儲存，相關檢查會標記待複核；行李數量不自動調整，已匯出的日曆也不會自動更新。</p>
        <div className="flex flex-wrap gap-3 mt-2"><label>出發日期<input className="block border rounded p-2" type="date" value={dateDraft.start} onChange={e=>setDateDraft({...dateDraft,start:e.target.value})} /></label><label>回程日期<input className="block border rounded p-2" type="date" value={dateDraft.end} onChange={e=>setDateDraft({...dateDraft,end:e.target.value})} /></label></div>
        <div className="flex flex-wrap gap-3 mt-2">{(['departure','return'] as const).map(key => <div key={key} className="timezone-field"><label>{key === 'departure' ? '出發地常用時區' : '回程地常用時區'}<select className="block border rounded p-2 w-full" value={['Asia/Taipei','Asia/Tokyo','Asia/Seoul','Asia/Singapore','Asia/Bangkok','Asia/Ho_Chi_Minh'].includes(timezoneDraft[key]) ? timezoneDraft[key] : ''} onChange={e=>setTimezoneDraft({...timezoneDraft,[key]:e.target.value})}><option value="">請選擇或自行輸入</option><option value="Asia/Taipei">臺灣（Asia/Taipei）</option><option value="Asia/Tokyo">日本（Asia/Tokyo）</option><option value="Asia/Seoul">韓國（Asia/Seoul）</option><option value="Asia/Singapore">新加坡（Asia/Singapore）</option><option value="Asia/Bangkok">泰國（Asia/Bangkok）</option><option value="Asia/Ho_Chi_Minh">越南（Asia/Ho_Chi_Minh）</option></select></label><details className="custom-timezone"><summary>自行輸入其他時區{timezoneDraft[key] && !['Asia/Taipei','Asia/Tokyo','Asia/Seoul','Asia/Singapore','Asia/Bangkok','Asia/Ho_Chi_Minh'].includes(timezoneDraft[key]) ? `（目前：${timezoneDraft[key]}）` : ''}</summary><label>{key === 'departure' ? '出發地時區（例如 Asia/Taipei）' : '回程地時區（例如 Asia/Tokyo）'}<input className="block border rounded p-2 w-full" value={timezoneDraft[key]} onChange={e=>setTimezoneDraft({...timezoneDraft,[key]:e.target.value})} /></label></details></div>)}</div>
        <p className="text-sm">時區未知可留白，日曆匯出時需補填；不使用裝置時區推算旅程當地時間。</p>
        <button type="button" className="border rounded p-2 mt-2" onClick={() => {
          const dep = timezoneDraft.departure.trim(), ret = timezoneDraft.return.trim();
          if ((dep && !isValidTimeZone(dep)) || (ret && !isValidTimeZone(ret))) { setDateNotice('時區格式無效，請輸入例如 Asia/Tokyo。'); return; }
          const days = inclusiveCalendarDays(dateDraft.start,dateDraft.end);
          if (!days) { setDateNotice('請確認日期有效，且回程不早於出發。'); return; }
          const startChanged = dateDraft.start !== dates.start || dep !== departureTimezone, endChanged = dateDraft.end !== dates.end || ret !== returnTimezone;
          if (!startChanged && !endChanged) { setDateNotice('日期與時區沒有變更。'); return; }
          setDates(dateDraft);
          setDepartureTimezone(dep); setReturnTimezone(ret); setTimezoneDraft({departure:dep,return:ret});
          setFinalTripDetails(prev => ({...prev,startDate:dateDraft.start,duration:days}));
          setGuardian(prev => markScheduleChanges(prev,startChanged,endChanged));
          setDateNotice('已更新日期與時區；如曾匯出日曆，請自行更新外部日曆。');
        }}>更新日期與時區</button>{dateNotice && <p role="status" className="text-sm mt-2">{dateNotice}</p>}
      </details>
      <div id="journey-emergency" tabIndex={-1}><EmergencyCard country={tripCountry} destination={destination} documents={documents} protection={travelProtection} onEdit={area => { const target = document.getElementById(`journey-${area}`); target?.scrollIntoView({behavior:'smooth',block:'start'}); target?.focus({preventScroll:true}); }} /></div>
      <div id="journey-documents" tabIndex={-1}><TripDocuments key={`documents-${activeListId ?? 'new'}`} documents={documents} onChange={(next,kind)=>{setDocuments(next);setGuardian(prev=>markDocumentChanges(prev,kind));}} /></div>
      <div id="journey-disruptions" tabIndex={-1}><TripDisruptions key={`disruptions-${activeListId ?? 'new'}`} documents={documents} disruptions={disruptions} transportPlans={transportPlans} protection={travelProtection} expenses={expenses} onNavigate={area => { const target = document.getElementById(`journey-${area}`); target?.scrollIntoView({behavior:'smooth',block:'start'}); target?.focus({preventScroll:true}); }} openRequest={disruptionOpenRequest} onChange={next=>{setDisruptions(next);setGuardian(prev=>markDocumentChanges(prev,'flight'));}} /></div>
      <div id="journey-transport" tabIndex={-1}><TransportPlans key={`transport-${activeListId ?? 'new'}`} documents={documents} plans={transportPlans} onChange={next=>{setTransportPlans(next);setGuardian(prev=>markDocumentChanges(prev,'flight'));}} /></div>
      <div id="journey-protection" tabIndex={-1}><TravelProtectionPanel key={`protection-${activeListId ?? 'new'}`} value={travelProtection} disruptions={disruptions} onChange={next=>{setTravelProtection(next);setGuardian(prev=>prev.tasks.G2 ? {...prev,tasks:{...prev.tasks,G2:{...prev.tasks.G2,needsReview:true}}} : prev);}} /></div>
      <div id="journey-expenses" tabIndex={-1}><TripExpenses key={`expenses-${activeListId ?? 'new'}`} expenses={expenses} disruptions={disruptions} rates={exchangeRates} onRatesChange={onRatesChange} items={crossBorderItems} defaultDestination={tripCountry === 'JP' ? 'TW' : 'unknown'} receiptRequest={expenseReceipt} onChange={(newExpenses,newItems)=>onShoppingChange(newExpenses,newItems)} /></div>
      <div id="journey-checks" tabIndex={-1}><GuardianPanel suggestions={{
        destination,
        device: travelProtection?.device || '',
        compatibility: travelProtection ? ({supported:'支援',unsupported:'不支援',unknown:'待確認'})[travelProtection.compatibility] : '',
        networkNeed: travelProtection?.need || '',
        flightTime: [onlyFlight?.startDate,onlyFlight?.startTime].filter(Boolean).join(' '),
        flightTimezone: onlyFlight?.startZone || '',
        lodgingContact: stays.length === 1 ? stays[0].contact : ''

      }} key={`guardian-${activeListId ?? 'new'}`} state={guardian} onChange={setGuardian} onConfigureTimezone={() => { if (tripSettingsRef.current) { tripSettingsRef.current.open = true; tripSettingsRef.current.scrollIntoView({behavior:'smooth',block:'start'}); tripSettingsRef.current.querySelector('select')?.focus({preventScroll:true}); } }} trip={{id:activeListId ?? '',start:dates.start,end:dates.end,departureTimezone,returnTimezone}} /></div>
      <button type="button" className="to-packing" onClick={() => { setJourneySection('packing'); window.scrollTo({top:0,behavior:'smooth'}); }}>接著準備行李 <i className="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      </div>
      <div hidden={journeySection !== 'packing'}>
      {/* Step 1 Header */}
      <div className="bg-white p-6 rounded-2xl shadow-lg shadow-slate-200/50 mb-6 border border-slate-100">
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
              disabled={riskGateReport.blocking > 0}
              className={`hidden md:flex px-6 py-3 rounded-xl font-bold transition shadow-lg items-center justify-center gap-2 ${riskGateReport.blocking > 0
                ? 'bg-slate-200 text-slate-400 shadow-slate-100 cursor-not-allowed'
                : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
                }`}
            >
              {riskGateReport.blocking > 0 ? `先排除高風險 (${riskGateReport.blocking})` : '完成並歸類'} <i className="fa-solid fa-check-circle"></i>
            </button>
            {CLOUD_FEATURES_ENABLED && (!collabSessionId ? (
              <button
                onClick={startCollab}
                className="hidden md:flex bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 px-4 py-3 rounded-xl font-bold transition shadow-sm items-center justify-center gap-2"
                title="開啟即時協作"
              >
                <i className="fa-solid fa-users"></i>
              </button>
            ) : (
              <div className="hidden md:flex bg-green-50 text-green-700 border border-green-200 px-4 py-3 rounded-xl font-bold transition shadow-sm items-center justify-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="text-xs">協作中</span>
              </div>
            ))}
          </div>
        </div>
        <div className="risk-info mb-5 rounded-2xl border px-4 py-3">
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
                  className={`px-2.5 py-1 rounded-full text-[11px] font-black ${idx === 0 ? 'bg-rose-700 text-white' : 'bg-red-700 text-white'
                    }`}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <details className="risk-settings"><summary>風險顯示與判定設定</summary><div className="mt-3 flex gap-2">
            <button
              onClick={() => handleRiskCopyVariantChange('serious')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${riskCopyVariant === 'serious'
                ? 'border-rose-700 bg-rose-700 text-white'
                : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'
                }`}
            >
              法規嚴肅版
            </button>
            <button
              onClick={() => handleRiskCopyVariantChange('friendly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black border transition ${riskCopyVariant === 'friendly'
                ? 'border-rose-700 bg-rose-700 text-white'
                : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'
                }`}
            >
              旅客易懂版
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-rose-700">風險模式：</span>
            <button
              onClick={() => handleRiskModeChange('standard')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black border ${
                riskMode === 'standard'
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              一般（只擋 Critical）
            </button>
            <button
              onClick={() => handleRiskModeChange('conservative')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-black border ${
                riskMode === 'conservative'
                  ? 'border-rose-700 bg-rose-700 text-white'
                  : 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100'
              }`}
            >
              保守（Critical + High 必清零）
            </button>
          </div>
          <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${riskModeGuidance.panelClass}`}>
            <div>{riskModeGuidance.title}</div>
            <div className="mt-0.5 opacity-90">{riskModeGuidance.description}</div>
          </div>
          {riskMode === 'standard' && (
            <div className="mt-2 rounded-lg border border-red-300 bg-red-100/80 px-2.5 py-2 text-[11px] font-black text-red-800">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              注意：一般模式不會強制擋下 High 風險。若你的目標是風險清零，建議切回保守模式。
            </div>
          )}
          </details>
        </div>

        <div
          className={`mb-5 rounded-2xl border p-4 ${riskGateReport.blocking > 0
            ? 'border-red-300 bg-red-50'
            : riskReport.summary.total > 0
              ? 'border-amber-300 bg-amber-50'
              : 'border-amber-200 bg-amber-50'
            }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={`text-sm font-black ${riskGateReport.blocking > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                <i className="fa-solid fa-shield-halved mr-2"></i>出入境風險檢查
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                來源核對日期 {RISK_RULESET_META.updatedAt}；規則會變更，請查詢最新資料
              </div>
              <div className="text-[11px] text-slate-500">資料可能不完整，請向航空公司與目的地主管機關確認；此結果不代表已符合規定。</div>
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

          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${riskGateReport.blocking > 0
            ? 'border-red-200 bg-red-100/60 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}>
            {riskGateReport.blocking > 0
              ? `尚有 ${riskGateReport.blocking} 個高風險項目，請先處理再完成。`
              : riskReport.summary.total > 0 ? `有 ${riskReport.summary.total} 項需要查證；品名無法確認是否合規。` : '未辨識到提示不代表物品合規；仍須自行確認航空與出入境規定。'}
          </div>
          {riskGateReport.blocking > 0 && (
            <div className="mt-2 text-xs font-semibold text-red-700">
              為什麼這很重要：高風險項目可能在安檢被沒收、延誤登機，嚴重時會有罰款或法律責任。
            </div>
          )}
          {riskGateReport.blocking > 0 && topBlockingIssue?.penalty && (
            <div className="mt-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-black text-red-800">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              最高風險可能後果：{topBlockingIssue.penalty.replace(/^可能後果：/, '')}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="text-xs font-black text-slate-800">
              <i className="fa-solid fa-stopwatch mr-1.5 text-slate-500" />
              安檢前 3 分鐘檢查清單
            </div>
            <div className="mt-1 text-[11px] text-slate-600">
              只列出尚未處理的高風險項目，請逐項定位並處理。
            </div>
            {securityGateChecklist.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {securityGateChecklist.map((issue) => (
                  <div key={`gate-${issue.itemId}-${issue.type}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-slate-800 truncate">{issue.itemName}</div>
                      <div className="text-[10px] text-slate-500">{getConsequenceLabel(issue.consequenceLevel)} ・ {issue.severity}</div>
                    </div>
                    <button
                      onClick={() => handleFocusRiskItem(issue.itemId)}
                      className="shrink-0 text-[11px] font-black px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      定位處理
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-[11px] font-semibold text-emerald-700">目前沒有待處理高風險項目。</div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {riskGateReport.blocking > 0 && (
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
              {sortedRiskIssues.map((issue) => {
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
                        {issue.type !== 'REVIEW' && <button
                          onClick={() => resolveRiskIssue(issue, defaultAction)}
                          className="text-xs font-black px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          {defaultAction === 'MOVE_TO_CARRY_ON'
                            ? '改為手提'
                            : defaultAction === 'MOVE_TO_CHECKED'
                              ? '改為託運'
                              : '移除項目'}
                        </button>}
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
                        {(issue.sourceUrls || []).map((source: {label:string;url:string})=><div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{source.label}</a></div>)}
                        <div>後果等級：{getConsequenceLabel(issue.consequenceLevel)}</div>
                        <div>可能後果：{issue.penalty || '-'}</div>
                        <div>
                          適用範圍請依官方來源確認；目前行程欄位不足以判定實際起訖機場與入境地。
                        </div>
                        <div>來源核對：{issue.ruleUpdatedAt || '-'}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {riskGateTouched && riskGateReport.blocking > 0 && (
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

        {/* Sticky Header Control Group */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md pt-4 pb-2 px-4 -mx-4 border-b border-slate-100 mb-4 transition-all shadow-sm">
          {/* 1. Search Bar (Top Priority) */}
          <div className="relative mb-3">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="搜尋物品（名稱）..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
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

          <div className="flex items-center justify-between gap-3">
            {/* 2. Category Tabs (Scrollable) */}
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide mask-linear-fade flex-1 min-w-0">
              <button
                onClick={() => setActiveCategory('ALL')}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all flex items-center gap-1.5 ${activeCategory === 'ALL'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                  }`}
              >
                <i className={`fa-solid fa-layer-group ${activeCategory === 'ALL' ? 'text-blue-300' : 'text-slate-400'}`}></i>
                全部
              </button>
              {Object.values(ItemCategory).map(cat => {
                let icon = '';
                switch (cat) {
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
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all flex items-center gap-1.5 ${activeCategory === cat
                      ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                      }`}
                  >
                    <i className={`fa-solid ${icon} ${activeCategory === cat ? 'text-blue-300' : 'text-slate-400'}`}></i>
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* 3. Batch Actions (Compact) */}
            <div className="flex gap-1 shrink-0 border-l border-slate-200 pl-3">
              <button
                onClick={() => handleBulkSetChecked(true)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                title="全選"
              >
                <i className="fa-solid fa-check-double text-xs"></i>
              </button>
              <button
                onClick={() => handleBulkSetChecked(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition"
                title="全不選"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3" style={{bottom:'calc(4rem + env(safe-area-inset-bottom))'}}>
          <button
            onClick={handleFinish}
            disabled={riskGateReport.blocking > 0}
            className={`w-full px-5 py-3 rounded-xl font-black text-base transition shadow-lg flex items-center justify-center gap-2 ${riskGateReport.blocking > 0
              ? 'bg-slate-200 text-slate-400 shadow-slate-100 cursor-not-allowed'
              : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200'
              }`}
          >
            {riskGateReport.blocking > 0 ? `先排除高風險 (${riskGateReport.blocking})` : '完成並歸類'}
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
            displayItems.map((item, index) => {
              const ruleConfig = getRuleConfig(item.rule);
              const prevItem = displayItems[index - 1];
              const showGroupHeader = activeCategory === 'ALL' &&
                !itemSearch.trim() &&
                sortBy === 'default' &&
                (!prevItem || prevItem.category !== item.category);

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className="bg-slate-50/95 px-5 py-2 border-b border-t border-slate-100 text-xs font-black text-slate-500 tracking-wider uppercase first:border-t-0">
                      {item.category}
                    </div>
                  )}
                  <div
                    id={`item-row-${item.id}`}
                    className={`packing-item-row flex items-center justify-between p-4 transition-colors border-b border-slate-50 last:border-0 ${
                      focusedRiskItemId === item.id
                        ? 'bg-yellow-50 ring-2 ring-yellow-200'
                        : item.checked
                          ? 'bg-white'
                          : 'bg-slate-50/30'
                    }`}
                  >
                    <div role="checkbox" aria-checked={item.checked} aria-label={`選擇 ${item.name}`} tabIndex={0} className="packing-item-select flex items-center flex-1 cursor-pointer select-none" onClick={() => handleToggleCheck(item.id)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleCheck(item.id); } }}>
                      <div className={`packing-item-check w-5 h-5 rounded-md border flex items-center justify-center transition-all ${item.checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-transparent bg-white'}`}>
                        <i className="fa-solid fa-check text-[10px]"></i>
                      </div>
                      <PackingItemIcon id={item.id} category={item.category} />
                      <div className={`packing-item-copy ${item.checked ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-base ${item.checked ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>{item.name}</p>
                          {item.weight && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                              <i className="fa-solid fa-weight-hanging text-[8px]"></i> {item.weight}kg
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 w-fit mt-1 border ${ruleConfig.style} ${item.checked ? '' : 'opacity-70'}`}>
                          <i className={`fa-solid ${ruleConfig.icon}`}></i>
                          {ruleConfig.label}
                        </span>
                      </div>
                    </div>

                    {item.checked && (
                      <div className="packing-item-quantity flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-200 shadow-sm ml-2">
                        <button
                          aria-label={`減少 ${item.name} 數量`}
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <i className="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span className="w-6 text-center font-bold text-sm text-slate-700">{item.quantity}</span>
                        <button
                          aria-label={`增加 ${item.name} 數量`}
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded bg-white text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>
                      </div>
                    )}
                    <button type="button" aria-label={`刪除 ${item.name}`} onClick={() => handleRemoveItem(item.id, item.name)} className="ml-2 w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                      <i className="fa-regular fa-trash-can" aria-hidden="true"></i>
                    </button>
                  </div>
                </React.Fragment>
              )
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              此分類無物品
            </div>
          )
          }
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
    </div>
  );
};

export default GeneratorTab;
