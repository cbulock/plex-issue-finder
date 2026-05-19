<script setup>
import { computed, ref, watch } from 'vue'
import { CindorButton, CindorCheckbox, CindorDataTable } from 'cindor-ui-vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  emptyMessage: {
    type: String,
    default: 'No rows to display.',
  },
  expandable: {
    type: Boolean,
    default: false,
  },
  expandedKeys: {
    type: Array,
    default: () => [],
  },
  rowKey: {
    type: String,
    default: 'id',
  },
  rowClass: {
    type: Function,
    default: null,
  },
  rows: {
    type: Array,
    required: true,
  },
  rowsPerPage: {
    type: Number,
    default: 20,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  selectedRows: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:expandedKeys', 'update:selectedRows'])

const currentPage = ref(1)
const activeSortKey = ref('')
const activeSortDirection = ref('ascending')

const selectedKeySet = computed(() => {
  return new Set(props.selectedRows.map((row) => String(row?.[props.rowKey])))
})

const expandedRowIds = computed(() => {
  return props.expandedKeys.map((key) => String(key))
})

const sortedRows = computed(() => {
  const rows = [...props.rows]
  if (!activeSortKey.value) return rows

  const column = props.columns.find((item) => item.key === activeSortKey.value)
  if (!column) return rows

  rows.sort((leftRow, rightRow) => {
    const leftValue = leftRow?.[column.key]
    const rightValue = rightRow?.[column.key]

    if (leftValue == null && rightValue == null) return 0
    if (leftValue == null) return 1
    if (rightValue == null) return -1

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return leftValue - rightValue
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })

  return activeSortDirection.value === 'descending' ? rows.reverse() : rows
})

const pageCount = computed(() => {
  return Math.max(1, Math.ceil(sortedRows.value.length / props.rowsPerPage))
})

const pageRows = computed(() => {
  const start = (currentPage.value - 1) * props.rowsPerPage
  return sortedRows.value.slice(start, start + props.rowsPerPage)
})

watch(pageCount, (count) => {
  if (currentPage.value > count) {
    currentPage.value = count
  }
})

const tableColumns = computed(() => {
  const columns = []

  if (props.selectable) {
    columns.push({
      key: '__select',
      label: '',
      align: 'center',
      headerDisplay: 'sr-only',
      headerLabel: 'Select',
      minWidth: '4rem',
      width: '4rem',
      cellSlot: 'cell-select',
    })
  }

  columns.push(...props.columns.map((column) => ({
    ...column,
    align: column.align ?? (column.width ? 'center' : undefined),
    cellSlot: `cell-${column.key}`,
    minWidth: column.minWidth ?? column.width,
  })))

  return columns
})

function updateSelectedRows(nextRows) {
  emit('update:selectedRows', nextRows)
}

function toggleRow(row, checked) {
  const key = String(row?.[props.rowKey])
  if (checked) {
    if (!selectedKeySet.value.has(key)) {
      updateSelectedRows([...props.selectedRows, row])
    }
    return
  }

  updateSelectedRows(props.selectedRows.filter((item) => String(item?.[props.rowKey]) !== key))
}

function selectCurrentPage() {
  const merged = [...props.selectedRows]
  for (const row of pageRows.value) {
    const key = String(row?.[props.rowKey])
    if (!selectedKeySet.value.has(key)) {
      merged.push(row)
    }
  }
  updateSelectedRows(merged)
}

function clearCurrentPage() {
  const pageKeySet = new Set(pageRows.value.map((row) => String(row?.[props.rowKey])))
  updateSelectedRows(props.selectedRows.filter((row) => !pageKeySet.has(String(row?.[props.rowKey]))))
}

function handleSortChange(event) {
  activeSortKey.value = event.detail.sortKey
  activeSortDirection.value = event.detail.sortDirection
}

function handlePageChange(event) {
  currentPage.value = event.detail?.currentPage ?? event.currentTarget?.currentPage ?? currentPage.value
}

function handleExpandedRowIdsUpdate(nextExpandedRowIds) {
  emit('update:expandedKeys', nextExpandedRowIds)
}

function slotName(prefix, row) {
  return `${prefix}-${String(row?.[props.rowKey])}`
}
</script>

<template>
  <div class="app-data-table">
    <div v-if="selectable" class="app-data-table__selection-actions">
      <CindorButton type="button" variant="ghost" @click="selectCurrentPage">
        <span class="button-content">
          <AppIcon name="check-check" :size="16" />
          <span>Select page</span>
        </span>
      </CindorButton>
      <CindorButton type="button" variant="ghost" @click="clearCurrentPage">
        <span class="button-content">
          <AppIcon name="x" :size="16" />
          <span>Clear page</span>
        </span>
      </CindorButton>
    </div>

    <CindorDataTable
      :columns="tableColumns"
      :current-page="currentPage"
      :empty-message="emptyMessage"
      :expandable-rows="expandable"
      :expanded-row-ids="expandedRowIds"
      :page-size="rowsPerPage"
      row-expansion-label="Details"
      row-expansion-slot="row-expansion"
      :rows="rows"
      :sort-direction="activeSortDirection"
      :sort-key="activeSortKey"
      :row-id-key="rowKey"
      @page-change="handlePageChange"
      @sort-change="handleSortChange"
      @update:expanded-row-ids="handleExpandedRowIdsUpdate"
    >
      <template
        v-for="row in rows"
        :key="`${row[rowKey]}-slots`"
      >
        <span
          v-if="selectable"
          :slot="slotName('cell-select', row)"
          class="app-data-table__cell-center"
        >
          <CindorCheckbox
            :model-value="selectedKeySet.has(String(row[rowKey]))"
            @update:model-value="toggleRow(row, $event)"
          />
        </span>
        <template v-for="column in columns" :key="`${row[rowKey]}-${column.key}`">
          <span :slot="slotName(`cell-${column.key}`, row)">
            <slot :name="`cell-${column.key}`" :row="row">
              {{ row[column.key] ?? '—' }}
            </slot>
          </span>
        </template>
        <div
          v-if="expandable"
          :slot="slotName('row-expansion', row)"
          class="app-data-table__inline-expansion"
        >
          <slot name="expanded" :row="row" />
        </div>
      </template>
    </CindorDataTable>
  </div>
</template>

<style scoped>
.app-data-table {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  width: 100%;
}

.app-data-table__selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.app-data-table__cell-center {
  display: inline-flex;
  justify-content: center;
  width: 100%;
}

.app-data-table__inline-expansion {
  min-width: 0;
}

.app-data-table :deep(cindor-data-table) {
  display: block;
  min-width: 0;
  max-width: 100%;
}

.app-data-table :deep([part~="row-toggle-button"]) {
  inline-size: 1.75rem;
  block-size: 1.75rem;
  min-inline-size: 1.75rem;
  padding: 0;
  font-size: var(--text-sm);
}
</style>
