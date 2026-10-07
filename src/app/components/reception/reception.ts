import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DeskVitals, PatientHit, QueueItem, ReceptionService } from '../../services/staff';
import { SpeechService } from '../../services/speech.service';
import { HttpClient } from '@angular/common/http';

const API = 'https://hospital-backend-yxe9.onrender.com/api';

interface FollowUpHit {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  followUpDate: string;
}

interface Column {
  label: string;
  tone: 'waiting' | 'consult' | 'lab' | 'done';
  items: QueueItem[];
}

interface Money {
  count: number;
  amount: number;
}

// Today's collection, from /api/reception/summary (same numbers the doctor sees)
interface Summary {
  date: string;
  patients: number;
  notBilled: number;
  split: number;
  cash: Money;
  upi: Money;
  total: Money;
  services: Record<string, Money>;
}

type FeeKey = 'consultation' | 'rbs' | 'ecg' | 'xray' | 'daycare';
type Fees = Record<FeeKey, string>;

const emptyFees = (): Fees => ({ consultation: '', rbs: '', ecg: '', xray: '', daycare: '' });

interface VisitForm {
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  phone: string;
  vitals: DeskVitals;
  fees: Fees;
  payCash: boolean;
  payUpi: boolean;
  cashPart: string; // used only when both Cash and UPI are selected
}

const emptyVitals = (): DeskVitals => ({
  bloodPressure: '',
  spo2: '',
  temperature: '',
  bloodSugar: '',
  weight: '',
  heartRate: '',
});

const emptyForm = (): VisitForm => ({
  patientId: '',
  patientName: '',
  age: '',
  gender: '',
  phone: '',
  vitals: emptyVitals(),
  fees: emptyFees(),
  payCash: false,
  payUpi: false,
  cashPart: '',
});

@Component({
  selector: 'app-reception',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../staff-shared.css'],
  styles: [
    `
      .ticket-info {
        flex: 1;
        min-width: 0;
      }
      .edit-btn {
        border: 1px solid var(--line);
        background: #fff;
        color: var(--muted);
        border-radius: 8px;
        padding: 5px 10px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .edit-btn:hover {
        border-color: var(--primary);
        color: var(--primary-dark);
      }
      .fup {
        background: #fff;
        border: 1px solid var(--line);
        border-left: 5px solid #0d9488;
        border-radius: 14px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .fup h4 {
        margin: 0 0 10px;
        font-size: 15px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .fup h4 small {
        display: inline;
        font-weight: 400;
      }
      .fup-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 10px;
      }
      .fup-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #f3fbfa;
      }
      .fup-info {
        min-width: 0;
      }
      .fup-info small {
        font-size: 12px;
      }
      .fup-due {
        display: inline-block;
        margin-top: 3px;
        font-size: 12px;
        font-weight: 700;
        color: #0f766e;
      }
      .fup-due.late {
        color: #b45309;
      }
      .ticket-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: stretch;
      }
      .noshow-btn {
        border: 1px solid #f0c4be;
        background: #fff5f4;
        color: #b42318;
        border-radius: 8px;
        padding: 5px 10px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .noshow-btn:hover {
        background: #fdecea;
      }
      .noshow-btn:disabled {
        opacity: 0.5;
        cursor: wait;
      }
      .at-lab {
        margin-top: 16px;
        background: #fff;
        border: 1px solid var(--line);
        border-top: 5px solid #7b61c9;
        border-radius: 14px;
        padding: 12px 14px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .at-lab h4 {
        margin: 0 6px 0 0;
        font-size: 15px;
      }
      .lab-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #ece6fa;
        color: #3f2f7a;
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 13px;
      }
      .reports-badge {
        display: block;
        width: fit-content;
        max-width: 100%;
        margin: 4px 0 2px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        color: #0f7a3d;
        background: #e3f6ea;
        border: 1px solid #9ad6b0;
        border-radius: 999px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
      }
      .voice-btn {
        border: 1px solid var(--line);
        background: #fff;
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .voice-btn.on {
        background: #e3f6ea;
        border-color: #9ad6b0;
        color: #0f7a3d;
      }
      .voice-banner {
        display: block;
        width: 100%;
        margin: 0 0 16px;
        padding: 14px 18px;
        border: 2px dashed #e0a100;
        background: #fff8e1;
        color: #7a5200;
        border-radius: 14px;
        font: inherit;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
      .voice-banner:hover {
        background: #fff1c2;
      }
      .coll {
        background: #fff;
        border: 1px solid #e3e8ee;
        border-radius: 14px;
        padding: 14px 16px;
        margin-bottom: 16px;
      }
      .coll-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .coll-head h3 {
        margin: 0;
        font-size: 15px;
      }
      .coll-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      .coll-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border: 1px solid #e3e8ee;
        border-radius: 12px;
        background: #f8fafc;
      }
      .coll-box small {
        font-size: 12px;
        color: #64748b;
        font-weight: 600;
      }
      .coll-box b {
        font-size: 22px;
      }
      .coll-box em {
        font-size: 12px;
        font-style: normal;
        color: #64748b;
      }
      .coll-box.total {
        background: #e3f6ea;
        border-color: #9ad6b0;
      }
      .coll-services {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 18px;
        margin-top: 12px;
        font-size: 13px;
        color: #475569;
      }
      .coll-warn {
        margin: 10px 0 0;
        padding: 8px 12px;
        background: #fff5f4;
        border: 1px solid #f0c4be;
        border-radius: 10px;
        color: #b42318;
        font-size: 13px;
        font-weight: 600;
      }
      @media (max-width: 720px) {
        .coll-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      .bill-card {
        background: #f6f8f7;
        border: 1px solid #dfe5e3;
        border-radius: 14px;
        padding: 4px 20px 18px;
        margin-top: 6px;
      }
      .bill-grid,
      .split-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 48px;
        align-items: center;
      }
      .bill-card .bill-field {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        margin: 0;
        padding: 16px 0;
        text-align: left;
        border-bottom: 1px solid #dfe5e3;
        cursor: text;
      }
      .bill-card .bill-field:focus-within {
        border-bottom-color: #0f7a3d;
      }
      .bill-card .bill-name {
        flex: 1;
        text-align: left;
        font-size: 15px;
        font-weight: 500;
        color: #16262d;
      }
      .bill-card .bill-rs {
        font-size: 14px;
        color: #6b7a80;
      }
      .bill-card .bill-field input {
        width: 96px;
        margin: -8px 0;
        padding: 8px 12px;
        border: 0;
        border-radius: 8px;
        outline: none;
        box-shadow: none;
        background: transparent;
        text-align: right;
        font: inherit;
        font-size: 16px;
        font-weight: 700;
        color: #16262d;
      }
      .bill-card .bill-field input:focus {
        box-shadow: 0 0 0 2px #0f7a3d;
      }
      .bill-card .bill-field input::placeholder {
        color: #16262d;
        opacity: 1;
      }
      .bill-due {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
        padding: 16px 18px;
        background: #132d36;
        color: #fff;
        border-radius: 10px;
      }
      .bill-due small {
        font-size: 12px;
        letter-spacing: 0.04em;
        opacity: 0.8;
      }
      .bill-due b {
        font-size: 22px;
      }
      .pay-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }
      .pay-label {
        margin-right: 10px;
        font-size: 12px;
        letter-spacing: 0.06em;
        color: #6b7a80;
      }
      .pay-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: 1px solid #dfe5e3;
        border-radius: 10px;
        background: #fff;
        font: inherit;
        font-size: 15px;
        color: #16262d;
        cursor: pointer;
      }
      .pay-pill i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b7a80;
      }
      .pay-pill.on {
        border-color: #0f7a3d;
        background: #e9f7ee;
        color: #0f7a3d;
      }
      .pay-pill.on i {
        background: #0f7a3d;
      }
      .split-row {
        margin-top: 6px;
      }
      .split-upi {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #dfe5e3;
      }
      .split-upi small {
        font-size: 13px;
        color: #6b7a80;
      }
      .split-upi b {
        font-size: 16px;
      }
      .pay-hint {
        margin: 10px 0 0;
        font-size: 12px;
        color: #6b7a80;
      }
      @media (max-width: 640px) {
        .bill-grid,
        .split-row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <header class="topbar">
      <div class="brand">
        <img class="logo-img sm" src="lungs.jpg" alt="" />
        <div><b>Chest &amp; Allergy Clinic</b><small>Reception</small></div>
      </div>
      <div class="who">{{ name }} <button class="ghost" (click)="logout()">Logout</button></div>
    </header>

    <main class="page">
      <section class="calling" [class.idle]="!calling">
        <span>Now calling</span>
        <strong>{{ calling ? calling.token : '—' }}</strong>
        <small>{{ calling ? calling.patientName : 'No one with the doctor right now' }}</small>
      </section>

      <button class="voice-banner" *ngIf="!voiceEnabled" (click)="toggleVoice()">
        🔇 Voice is OFF. Click here once to turn on patient calling voice
      </button>

      <nav class="tabs">
        <button [class.active]="tab === 'board'" (click)="tab = 'board'">Board</button>
        <button [class.active]="tab === 'patients'" (click)="tab = 'patients'">Patients</button>
        <span class="refresh" *ngIf="updated"
          >Updated {{ updated | date: 'shortTime' }} · auto-refresh 5s</span
        >
        <button class="voice-btn" [class.on]="voiceEnabled" (click)="toggleVoice()">
          {{ voiceEnabled ? '🔊 Voice on' : '🔇 Enable voice' }}
        </button>
        <button class="primary-btn" (click)="openForm()">＋ New visit</button>
      </nav>

      <ng-container *ngIf="tab === 'board'">
        <section class="coll" *ngIf="summary as s">
          <div class="coll-head">
            <h3>Today's collection</h3>
            <small>{{ s.date | date: 'dd MMM yyyy' }}</small>
          </div>

          <div class="coll-grid">
            <div class="coll-box">
              <small>Patients</small>
              <b>{{ s.patients }}</b>
            </div>
            <div class="coll-box">
              <small>Cash</small>
              <b>₹{{ s.cash.amount }}</b>
              <em>{{ s.cash.count }} patients</em>
            </div>
            <div class="coll-box">
              <small>UPI</small>
              <b>₹{{ s.upi.amount }}</b>
              <em>{{ s.upi.count }} patients</em>
            </div>
            <div class="coll-box total">
              <small>Total</small>
              <b>₹{{ s.total.amount }}</b>
              <em>{{ s.total.count }} billed</em>
            </div>
          </div>

          <div class="coll-services">
            <span *ngFor="let item of serviceList">
              {{ item.label }}: <b>{{ s.services[item.key]?.count || 0 }}</b> · ₹{{
                s.services[item.key]?.amount || 0
              }}
            </span>
            <span *ngIf="s.split">Split (cash + UPI): <b>{{ s.split }}</b></span>
          </div>

          <p class="coll-warn" *ngIf="s.notBilled">
            ⚠ {{ s.notBilled }} patient(s) have no bill entered
          </p>
        </section>
      </ng-container>

      <p class="notice ok" *ngIf="message">{{ message }}</p>

      <!-- BOARD -->
      <section *ngIf="tab === 'board'">
        <p class="error" *ngIf="loadError">{{ loadError }}</p>
        <div class="fup" *ngIf="followUps.length">
          <h4>
            📅 Follow-up patients <span class="count">{{ followUps.length }}</span>
            <small>due today or earlier this week, not yet come back</small>
          </h4>
          <div class="fup-list">
            <div class="fup-item" *ngFor="let f of followUps">
              <div class="fup-info">
                <b>{{ f.patientName }}</b>
                <small>{{ f.patientId }} · {{ f.age }} · {{ f.gender }} · 📞 {{ f.phone }}</small>
                <span class="fup-due" [class.late]="f.followUpDate < todayStr">{{
                  f.followUpDate === todayStr ? 'Due today' : 'Due ' + (f.followUpDate | date: 'dd MMM')
                }}</span>
              </div>
              <button class="btn sm" (click)="addFollowUp(f)">＋ Add to queue</button>
            </div>
          </div>
        </div>

        <div class="cols">
          <div class="col" *ngFor="let col of columns" [attr.data-tone]="col.tone">
            <h3>
              {{ col.label }} <span class="count">{{ col.items.length }}</span>
            </h3>
            <div class="ticket" *ngFor="let v of col.items; trackBy: trackById">
              <span class="tok">{{ v.token }}</span>
              <div class="ticket-info">
                <b>{{ v.patientName }}</b>
                <span class="reports-badge" *ngIf="isReportsReady(v)">🧪 Reports ready</span>
                <small>{{ v.age }} · {{ v.gender }} · {{ v.phone }}</small>
              </div>
              <div class="ticket-actions">
                <button class="edit-btn" (click)="openEdit(v)" aria-label="Edit patient details">
                  ✎ Edit
                </button>
                <button
                  class="noshow-btn"
                  *ngIf="v.status === 'Waiting'"
                  [disabled]="busyId === v._id"
                  (click)="markNoShow(v)"
                  title="Patient did not come"
                >
                  ✕ No show
                </button>
              </div>
            </div>
            <p class="empty" *ngIf="!col.items.length">Nobody here</p>
          </div>
        </div>

        <div class="at-lab" *ngIf="atLab.length">
          <h4>
            🧪 At lab <span class="count">{{ atLab.length }}</span>
          </h4>
          <span class="lab-chip" *ngFor="let v of atLab; trackBy: trackById">
            <b>{{ v.token }}</b> {{ v.patientName }}
          </span>
        </div>
      </section>

      <!-- PATIENTS -->
      <section *ngIf="tab === 'patients'" class="card">
        <h2>Find old patient</h2>
        <input
          placeholder="Name, phone or PT-ID"
          [(ngModel)]="search"
          (ngModelChange)="onSearch()"
        />
        <p class="error" *ngIf="phoneError">{{ phoneError }}</p>
        <p class="empty" *ngIf="searched && !hits.length">No patient found</p>
        <div class="hit" *ngFor="let p of hits">
          <div class="hit-info">
            <b>{{ p.patientName }}</b>
            <small
              >{{ p.patientId }} · {{ p.age }} · {{ p.gender }} · last visit
              {{ p.lastVisit | date: 'dd/MM/yyyy' }}</small
            >
            <ng-container *ngIf="phoneEdit?.id !== p.patientId; else editing">
              <small
                >📞 {{ p.phone }}
                <a class="link" (click)="phoneEdit = { id: p.patientId, value: p.phone }"
                  >Fix number</a
                ></small
              >
            </ng-container>
            <ng-template #editing>
              <div class="inline">
                <input [(ngModel)]="phoneEdit!.value" maxlength="10" inputmode="numeric" />
                <button class="btn sm" (click)="savePhone(p)">Save</button>
                <button class="ghost" (click)="phoneEdit = null">Cancel</button>
              </div>
            </ng-template>
          </div>
          <button class="btn sm" (click)="openForm(p)">New visit</button>
        </div>
      </section>
    </main>

    <!-- NEW / EDIT VISIT MODAL -->
    <div class="overlay" *ngIf="formOpen" (click)="closeForm()"></div>
    <section class="visit-modal" *ngIf="formOpen" role="dialog" aria-modal="true">
      <header>
        <div>
          <small>{{ editingId ? 'EDIT RECORD' : 'NEW RECORD' }}</small>
          <h2>{{ editingId ? 'Edit patient details' : 'New patient visit' }}</h2>
        </div>
        <button class="icon-btn" (click)="closeForm()" aria-label="Close">×</button>
      </header>

      <div class="modal-body">
        <div class="form-section">
          <div class="lookup-row" *ngIf="!editingId; else phoneOnly">
            <label
              >Phone number *
              <input
                [(ngModel)]="form.phone"
                (ngModelChange)="onPhoneTyped()"
                maxlength="10"
                inputmode="numeric"
                placeholder="10-digit mobile"
              />
            </label>
            <button class="outline-btn" (click)="findPatient()">Find patient</button>
          </div>
          <ng-template #phoneOnly>
            <label
              >Phone number *
              <input
                [(ngModel)]="form.phone"
                maxlength="10"
                inputmode="numeric"
                placeholder="10-digit mobile"
              />
            </label>
          </ng-template>

          <p class="found" *ngIf="lookupMsg">{{ lookupMsg }}</p>
          <div class="chip-list" *ngIf="matches.length">
            <button *ngFor="let m of matches" class="pick" (click)="usePatient(m)">
              {{ m.patientName }} · {{ m.age }} · {{ m.gender }} · {{ m.patientId }}
            </button>
            <button class="pick" (click)="newOnSamePhone()">+ New patient on this number</button>
          </div>

          <label
            >Patient name *
            <input
              [(ngModel)]="form.patientName"
              (ngModelChange)="onNameTyped()"
              placeholder="Full name"
            />
          </label>

          <div class="form-grid">
            <label
              >Age *
              <input [(ngModel)]="form.age" inputmode="numeric" maxlength="3" placeholder="Years" />
            </label>
            <label
              >Gender *
              <select [(ngModel)]="form.gender">
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </label>
          </div>

          <h4 class="sub-head">Vitals</h4>
          <div class="form-grid three">
            <label>BP<input [(ngModel)]="form.vitals.bloodPressure" placeholder="120/80" /></label>
            <label>SpO2<input [(ngModel)]="form.vitals.spo2" placeholder="%" /></label>
            <label
              >Temperature<input [(ngModel)]="form.vitals.temperature" placeholder="98.6 °F"
            /></label>
            <label>RBS<input [(ngModel)]="form.vitals.bloodSugar" placeholder="mg/dL" /></label>
            <label>Weight<input [(ngModel)]="form.vitals.weight" placeholder="kg" /></label>
            <label>Heart rate<input [(ngModel)]="form.vitals.heartRate" placeholder="bpm" /></label>
          </div>

          <h4 class="sub-head">Billing (₹)</h4>
          <div class="bill-card">
            <div class="bill-grid">
              <div class="bill-field" *ngFor="let item of feeItems" (click)="amt.focus()">
                <span class="bill-name">{{ item.label }}</span>
                <span class="bill-rs">₹</span>
                <input
                  #amt
                  [(ngModel)]="form.fees[item.key]"
                  inputmode="numeric"
                  maxlength="7"
                  placeholder="0"
                />
              </div>
              <div class="bill-due">
                <small>TOTAL DUE</small>
                <b>₹ {{ billTotal | number: '1.2-2' }}</b>
              </div>
            </div>

            <div class="pay-row">
              <span class="pay-label">PAID BY</span>
              <button
                type="button"
                class="pay-pill"
                [class.on]="form.payCash"
                (click)="form.payCash = !form.payCash"
              >
                <i></i>Cash
              </button>
              <button
                type="button"
                class="pay-pill"
                [class.on]="form.payUpi"
                (click)="form.payUpi = !form.payUpi"
              >
                <i></i>UPI
              </button>
            </div>

            <div class="split-row" *ngIf="form.payCash && form.payUpi">
              <div class="bill-field" (click)="cashIn.focus()">
                <span class="bill-name">Cash given</span>
                <span class="bill-rs">₹</span>
                <input
                  #cashIn
                  [(ngModel)]="form.cashPart"
                  inputmode="numeric"
                  maxlength="7"
                  placeholder="0"
                />
              </div>
              <div class="split-upi">
                <small>UPI (remaining)</small>
                <b>₹ {{ upiAmount | number: '1.2-2' }}</b>
              </div>
            </div>
            <p class="pay-hint" *ngIf="billTotal > 0 && !(form.payCash && form.payUpi)">
              Part cash, part UPI? Select both.
            </p>
          </div>

          <p class="error" *ngIf="formError">{{ formError }}</p>
        </div>
      </div>

      <footer>
        <button class="outline-btn" (click)="closeForm()">Cancel</button>
        <button class="primary-btn" [disabled]="saving" (click)="submit()">
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Register & get token' }}
        </button>
      </footer>
    </section>
  `,
})
export class Reception implements OnInit, OnDestroy {
  tab: 'board' | 'patients' = 'board';
  columns: Column[] = [];
  followUps: FollowUpHit[] = [];
  todayStr = '';
  private boardSig = '';
  atLab: QueueItem[] = [];
  calling: QueueItem | null = null;
  updated: Date | null = null;
  summary: Summary | null = null;
  readonly serviceList = [
    { key: 'consultation', label: 'Consultation' },
    { key: 'rbs', label: 'RBS' },
    { key: 'ecg', label: 'ECG' },
    { key: 'xray', label: 'X-ray' },
    { key: 'daycare', label: 'Daycare' },
  ];
  loadError = '';
  message = '';
  busyId: string | null = null;

  formOpen = false;
  form: VisitForm = emptyForm();
  editingId: string | null = null;
  formError = '';
  lookupMsg = '';
  pickedName = '';
  matches: PatientHit[] = [];
  saving = false;

  search = '';
  hits: PatientHit[] = [];
  searched = false;
  phoneEdit: { id: string; value: string } | null = null;
  phoneError = '';

  readonly feeItems: { key: FeeKey; label: string }[] = [
    { key: 'consultation', label: 'Consultation fee' },
    { key: 'rbs', label: 'RBS' },
    { key: 'ecg', label: 'ECG' },
    { key: 'xray', label: 'X-ray' },
    { key: 'daycare', label: 'Daycare' },
  ];

  voiceEnabled = false;
  private lastCalledId: string | null = null;

  private refreshTimer?: ReturnType<typeof setInterval>;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ReceptionService,
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private speech: SpeechService,
  ) {}

  get name(): string {
    return this.auth.getUsername();
  }

  ngOnInit(): void {
    this.load();
    this.refreshTimer = setInterval(() => this.load(), 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    clearTimeout(this.searchTimer);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.formOpen) this.closeForm();
  }

  trackById = (_: number, v: QueueItem) => v._id;

  get billTotal(): number {
    return this.feeItems.reduce((sum, item) => sum + (Number(this.form.fees[item.key]) || 0), 0);
  }

  // Only Cash: all of it. Both: what the patient handed over in cash. Only UPI: none.
  get cashAmount(): number {
    const total = this.billTotal;
    if (!total || !this.form.payCash) return 0;
    if (!this.form.payUpi) return total;
    return Math.min(Math.max(Number(this.form.cashPart) || 0, 0), total);
  }

  // Whatever is left after the cash goes to UPI
  get upiAmount(): number {
    const total = this.billTotal;
    if (!total || !this.form.payUpi) return 0;
    return total - this.cashAmount;
  }

  // ---- Reports ready + Voice ----

  isReportsReady(v: QueueItem): boolean {
    const x = v as QueueItem & { labReady?: boolean };
    return !!x.labReady && v.status !== 'Completed';
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    if (this.voiceEnabled) {
      this.speech.unlock();
      this.speech.speak('Voice announcements enabled', 1);
    }
  }

  private announceIfNew(): void {
    if (!this.calling) {
      this.lastCalledId = null;
      return;
    }
    const id = this.calling._id || null;
    if (id === this.lastCalledId) return;
    this.lastCalledId = id;

    if (!this.voiceEnabled) return;

    const spokenToken = String(this.calling.token)
      .replace(/[^A-Za-z0-9]/g, '')
      .split('')
      .join(' ');
    this.speech.speak(
      `Calling token ${spokenToken}, ${this.calling.patientName}. Please go to the doctor.`,
    );
  }

  private loadFollowUps(): void {
    this.http
      .get<{ today: string; list: FollowUpHit[] }>(`${API}/reception/followups`, {
        withCredentials: true,
      })
      .subscribe({
        next: (r) => {
          this.todayStr = r.today;
          this.followUps = r.list;
        },
        error: () => {},
      });
  }

  // One click: opens the new-visit form with the old patient's details filled in
  addFollowUp(f: FollowUpHit): void {
    this.openForm({ ...f, lastVisit: '' } as unknown as PatientHit);
  }

  private load(): void {
    this.api.board().subscribe({
      next: (visits) => {
        this.loadError = '';
        this.updated = new Date();
        const by = (status: string) => visits.filter((v) => v.status === status);
        this.columns = [
          { label: 'Waiting', tone: 'waiting', items: by('Waiting') },
          { label: 'In consultation', tone: 'consult', items: by('In consultation') },
          { label: 'Completed', tone: 'done', items: by('Completed') },
        ];
        this.atLab = by('Lab investigation');
        // Reload the follow-up list only when the queue changed (new visit, no show...)
        const sig = visits.map((v) => v._id + v.status).join('|');
        if (sig !== this.boardSig) {
          this.boardSig = sig;
          this.loadFollowUps();
        }
        this.calling = this.columns[1].items[0] || null;
        this.announceIfNew();
        this.loadSummary();
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/welcome']);
          return;
        }
        this.loadError = 'Could not refresh the queue. Retrying…';
      },
    });
  }

  // Today's cash / UPI / total (kept quiet on errors: the card simply stays hidden)
  private loadSummary(): void {
    this.http.get<Summary>(`${API}/reception/summary`, { withCredentials: true }).subscribe({
      next: (summary) => (this.summary = summary),
      error: () => {},
    });
  }

  // Patient took a token but did not come: remove from the waiting list.
  // The record stays in history; if the patient comes later, register a new visit.
  markNoShow(v: QueueItem): void {
    if (!v._id || this.busyId) return;
    if (!confirm(`Mark ${v.patientName} (${v.token}) as No show?`)) return;
    this.busyId = v._id;
    this.http
      .patch(`${API}/reception/visits/${v._id}/no-show`, {}, { withCredentials: true })
      .subscribe({
        next: () => {
          this.busyId = null;
          this.message = `${v.patientName} marked as No show.`;
          this.load();
        },
        error: (err) => {
          this.busyId = null;
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/welcome']);
            return;
          }
          this.loadError = err?.error?.message || 'Could not update. Please try again.';
          this.load();
        },
      });
  }

  // ---- New visit modal ----

  openForm(patient?: PatientHit): void {
    this.form = emptyForm();
    this.editingId = null;
    this.formError = '';
    this.lookupMsg = '';
    this.matches = [];
    this.message = '';
    if (patient) this.usePatient(patient);
    this.formOpen = true;
  }

  // ---- Edit visit (page 1 only: name, age, gender, phone, vitals) ----

  openEdit(v: QueueItem): void {
    const vit = (v as QueueItem & { vitals?: Partial<DeskVitals> }).vitals || {};
    const bill = v as QueueItem & {
      fees?: Partial<Record<FeeKey, number>>;
      paymentMode?: string;
      cashAmount?: number;
      upiAmount?: number;
    };
    const fees = emptyFees();
    this.feeItems.forEach((item) => {
      const amount = bill.fees?.[item.key];
      fees[item.key] = amount ? String(amount) : '';
    });
    const paid = this.feeItems.reduce((sum, item) => sum + (bill.fees?.[item.key] || 0), 0);
    let cash = bill.cashAmount || 0;
    let upi = bill.upiAmount || 0;
    if (!cash && !upi) {
      if (bill.paymentMode === 'Cash') cash = paid;
      if (bill.paymentMode === 'UPI') upi = paid;
    }
    this.form = {
      patientId: v.patientId || '',
      patientName: v.patientName || '',
      age: String(v.age || ''),
      gender: v.gender || '',
      phone: v.phone || '',
      vitals: { ...emptyVitals(), ...vit } as DeskVitals,
      fees,
      payCash: cash > 0,
      payUpi: upi > 0,
      cashPart: cash > 0 && upi > 0 ? String(cash) : '',
    };
    this.editingId = v._id || null;
    this.formError = '';
    this.lookupMsg = '';
    this.matches = [];
    this.message = '';
    this.formOpen = true;
  }

  closeForm(): void {
    this.formOpen = false;
    this.editingId = null;
  }

  usePatient(p: PatientHit): void {
    this.form.patientId = p.patientId;
    this.form.patientName = p.patientName;
    this.form.age = p.age;
    this.form.gender = p.gender;
    this.form.phone = p.phone;
    this.lookupMsg = `Existing patient: ${p.patientName} (${p.patientId})`;
    this.pickedName = p.patientName;
    this.matches = [];
  }

  // Same phone, different family member: keep the phone, clear the rest, new ID
  newOnSamePhone(): void {
    this.form.patientId = '';
    this.form.patientName = '';
    this.form.age = '';
    this.form.gender = '';
    this.pickedName = '';
    this.matches = [];
    this.lookupMsg = 'New patient on this number. Fill in the details below.';
  }

  // Name changed after picking an old patient: this is a different person, drop the old ID
  onNameTyped(): void {
    if (
      this.form.patientId &&
      this.form.patientName.trim().toLowerCase() !== this.pickedName.trim().toLowerCase()
    ) {
      this.form.patientId = '';
      this.pickedName = '';
      this.lookupMsg = 'Name changed, so this will be saved as a new patient.';
    }
  }

  onPhoneTyped(): void {
    if (this.form.patientId) {
      this.form.patientId = '';
      this.lookupMsg = '';
    }
  }

  findPatient(): void {
    this.formError = '';
    if (!/^\d{10}$/.test(this.form.phone)) {
      this.formError = 'Enter the 10-digit phone number first';
      return;
    }
    this.api.patients(this.form.phone).subscribe({
      next: (hits) => {
        const exact = hits.filter((h) => h.phone === this.form.phone);
        if (exact.length) {
          // Always let the receptionist choose: the number may belong to a family
          this.matches = exact;
          this.lookupMsg =
            exact.length === 1
              ? 'Found 1 patient on this number. Tap the name, or add a new patient:'
              : `Found ${exact.length} patients on this number. Pick one, or add a new patient:`;
        } else {
          this.matches = [];
          this.lookupMsg = 'New patient. Fill in the details below.';
        }
      },
      error: () => (this.formError = 'Could not search right now'),
    });
  }

  submit(): void {
    const f = this.form;

    if (
      !f.patientName.trim() ||
      !/^\d{1,3}$/.test(f.age) ||
      !f.gender ||
      !/^\d{10}$/.test(f.phone)
    ) {
      this.formError = 'Enter name, age, gender and a 10-digit phone number';
      return;
    }

    const badFee = this.feeItems.find((item) => !/^\d{0,7}$/.test(String(f.fees[item.key]).trim()));
    if (badFee) {
      this.formError = `${badFee.label}: enter the amount in numbers only`;
      return;
    }
    if (this.billTotal > 0) {
      if (!f.payCash && !f.payUpi) {
        this.formError = 'Choose Cash or UPI (or both) for the amount entered';
        return;
      }
      if (f.payCash && f.payUpi && (this.cashAmount <= 0 || this.cashAmount >= this.billTotal)) {
        this.formError =
          'Split payment: enter the cash given. It must be less than the total, the rest goes to UPI';
        return;
      }
    }

    const billing = {
      fees: Object.fromEntries(
        this.feeItems.map((item) => [item.key, Number(f.fees[item.key]) || 0]),
      ),
      payment: { cash: this.cashAmount, upi: this.upiAmount },
    };

    this.saving = true;
    this.formError = '';

    // EDIT: PUT /api/reception/visits/:id  (receptionist route)
    if (this.editingId) {
      this.http
        .put<QueueItem>(
          `${API}/reception/visits/${this.editingId}`,
          {
            patientName: f.patientName.trim(),
            age: f.age,
            gender: f.gender,
            phone: f.phone,
            vitals: f.vitals,
            ...billing,
          },
          { withCredentials: true },
        )
        .subscribe({
          next: (visit) => {
            this.saving = false;
            this.formOpen = false;
            this.editingId = null;
            this.message = `${visit.patientName} details updated`;
            this.load();
          },
          error: (err) => {
            this.saving = false;
            this.formError = err?.error?.message || 'Could not save the changes';
          },
        });
      return;
    }

    // NEW VISIT: POST /api/reception/visits  (receptionist route)
    this.http
      .post<QueueItem>(
        `${API}/reception/visits`,
        {
          patientId: f.patientId || undefined,
          patientName: f.patientName.trim(),
          age: f.age,
          gender: f.gender,
          phone: f.phone,
          vitals: f.vitals,
          ...billing,
        },
        { withCredentials: true },
      )
      .subscribe({
        next: (visit) => {
          this.saving = false;
          this.formOpen = false;
          this.tab = 'board';
          this.message = `${visit.patientName} added to the queue. Token ${visit.token}`;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.formError = err?.error?.message || 'Could not add the patient';
        },
      });
  }

  // ---- Patients tab ----

  onSearch(): void {
    clearTimeout(this.searchTimer);
    const term = this.search.trim();
    if (term.length < 2) {
      this.hits = [];
      this.searched = false;
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.api.patients(term).subscribe({
        next: (hits) => {
          this.hits = hits;
          this.searched = true;
        },
        error: () => {
          this.hits = [];
          this.searched = true;
        },
      });
    }, 300);
  }

  savePhone(p: PatientHit): void {
    const phone = (this.phoneEdit?.value || '').trim();
    if (!/^\d{10}$/.test(phone)) {
      this.phoneError = 'Enter a 10-digit phone number';
      return;
    }
    this.api.updatePhone(p.patientId, phone).subscribe({
      next: () => {
        p.phone = phone;
        this.phoneEdit = null;
        this.phoneError = '';
        this.message = 'Phone number updated';
      },
      error: (err) => (this.phoneError = err?.error?.message || 'Could not update the number'),
    });
  }

  logout(): void {
    const leave = () => this.router.navigate(['/welcome']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}