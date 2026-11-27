import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../utils/date.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {addCalendarDays,inclusiveCalendarDays}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('calendar days handle year change and daylight saving without device timezone arithmetic',()=>{assert.equal(addCalendarDays('2026-12-31',1),'2027-01-01');assert.equal(addCalendarDays('2026-03-07',2),'2026-03-09');assert.equal(inclusiveCalendarDays('2026-03-07','2026-03-09'),3);});
test('invalid and reversed dates are rejected',()=>{assert.equal(addCalendarDays('2026-02-30',1),null);assert.equal(inclusiveCalendarDays('2026-02-30','2026-03-02'),0);assert.equal(inclusiveCalendarDays('2026-11-08','2026-11-07'),0);});
