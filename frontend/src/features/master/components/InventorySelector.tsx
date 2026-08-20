import { useCallback } from 'react';
import SearchSelect, { type SearchSelectProps } from '../../../components/SearchSelect';
import { masterLookupApi } from '../master-reference.api';
import type { InventoryReference } from '../master-reference.types';

type InventorySelectorProps = Omit<SearchSelectProps<InventoryReference>, 'search' | 'getKey' | 'renderOption'>;

export default function InventorySelector(props: InventorySelectorProps) {
  const search = useCallback(
    (keyword: string) => masterLookupApi.getInventories(keyword),
    [],
  );
  return (
    <SearchSelect
      {...props}
      search={search}
      getKey={(item) => item.id}
      renderOption={(item) => `${item.id} — ${item.name}${item.unit ? ` (${item.unit})` : ''}`}
      emptyMessage="자재번호 또는 자재명을 입력하세요."
    />
  );
}
