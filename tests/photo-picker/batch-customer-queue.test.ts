import test from "node:test";
import assert from "node:assert/strict";
import { useAppStore } from "../../src/core/stores/useAppStore.ts";

test("Batch Customer Queue: Mode switching and single vs multi behavior", () => {
  const store = useAppStore.getState();

  // 1. Single mode: adding folder keeps only 1
  store.setPickerMode("single");
  store.clearInputFolders();

  store.addInputFolder("/data/folder_A");
  assert.equal(useAppStore.getState().inputFolders.length, 1);
  assert.equal(useAppStore.getState().inputFolders[0], "/data/folder_A");

  store.addInputFolder("/data/folder_B");
  assert.equal(useAppStore.getState().inputFolders.length, 1);
  assert.equal(useAppStore.getState().inputFolders[0], "/data/folder_B");

  // 2. Multi mode: queues multiple folders and dedupes
  store.setPickerMode("multi");
  store.clearInputFolders();

  store.addBatchInputFolders([
    "/data/1-9 8h Hà Tiny 2cc",
    "/data/1-9 9h Như Quỳnh 1cc",
    "/data/1-9 10h Linh Thùy 1cc",
  ]);

  const stateMulti = useAppStore.getState();
  assert.equal(stateMulti.inputFolders.length, 3);
  // By default, first folder is selected
  assert.equal(stateMulti.selectedInputFolders.length, 1);
  assert.equal(stateMulti.selectedInputFolders[0], "/data/1-9 8h Hà Tiny 2cc");

  // Adding duplicate folder does not duplicate
  store.addInputFolder("/data/1-9 8h Hà Tiny 2cc");
  assert.equal(useAppStore.getState().inputFolders.length, 3);
});

test("Batch Customer Queue: Single-active checkbox rule (only 1 active at a time)", () => {
  const store = useAppStore.getState();
  store.setPickerMode("multi");
  store.clearInputFolders();

  store.addBatchInputFolders([
    "/data/Customer_1",
    "/data/Customer_2",
    "/data/Customer_3",
  ]);

  // Activate Customer 2
  store.selectSingleInputFolder("/data/Customer_2");
  assert.deepEqual(useAppStore.getState().selectedInputFolders, ["/data/Customer_2"]);

  // Activate Customer 3
  store.selectSingleInputFolder("/data/Customer_3");
  assert.deepEqual(useAppStore.getState().selectedInputFolders, ["/data/Customer_3"]);
});

test("Batch Customer Queue: Removing completed customer auto-selects next customer", () => {
  const store = useAppStore.getState();
  store.setPickerMode("multi");
  store.clearInputFolders();

  store.addBatchInputFolders([
    "/data/Customer_A",
    "/data/Customer_B",
    "/data/Customer_C",
  ]);

  store.selectSingleInputFolder("/data/Customer_A");
  assert.equal(useAppStore.getState().selectedInputFolders[0], "/data/Customer_A");

  // Remove completed Customer_A
  store.removeInputFolder("/data/Customer_A");

  const state = useAppStore.getState();
  assert.equal(state.inputFolders.length, 2);
  // Customer_B is now automatically active
  assert.equal(state.selectedInputFolders[0], "/data/Customer_B");
});

test("Batch Customer Queue: Vietnamese diacritic-insensitive search and prioritization", () => {
  const folders = [
    "/data/Tháng 9/01-09/1-9 14h Phương Thảo 2cc",
    "/data/Tháng 9/01-09/1-9 8h Hà Tiny 2cc",
    "/data/Tháng 9/01-09/1-9 9h Như Quỳnh 1cc",
  ];

  const getFolderName = (p: string) => p.split(/[/\\]+/).filter(Boolean).pop() || p;

  const searchQuery = "ha tiny";
  const q = searchQuery.toLowerCase().trim();
  const normQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filtered = [...folders]
    .sort((a, b) => {
      const nameA = getFolderName(a).toLowerCase();
      const nameB = getFolderName(b).toLowerCase();
      const normA = nameA.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normB = nameB.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const matchA = normA.includes(normQ);
      const matchB = normB.includes(normQ);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return 0;
    })
    .filter((f) => {
      const name = getFolderName(f).toLowerCase();
      const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return norm.includes(normQ) || f.toLowerCase().includes(q);
    });

  assert.equal(filtered.length, 1);
  assert.ok(filtered[0].includes("Hà Tiny"));
});
