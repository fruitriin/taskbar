declare global {
  interface Array<T> {
    columns<K extends keyof T>(columnKey: K): Array<T[K]>
    columns<K extends keyof T, I extends keyof T>(
      columnKey: K,
      indexKey: I
    ): Record<string, object>
  }
}

Array.prototype.columns = function <T, K extends keyof T, I extends keyof T>(
  columnKey: K,
  indexKey?: I
): Array<T[K]> | Record<string, object> {
  if (indexKey !== undefined) {
    const result: Record<string, object> = {}
    for (const item of this) {
      if (item && typeof item === 'object') {
        const key = String(item[indexKey])
        result[key] = item[columnKey] as object
      }
    }
    return result
  } else {
    return this.map((item: T) => (item && typeof item === 'object' ? item[columnKey] : undefined))
  }
}

export {}