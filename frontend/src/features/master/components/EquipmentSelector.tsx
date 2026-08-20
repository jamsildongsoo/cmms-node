import { useCallback } from 'react';
import SearchSelect, { type SearchSelectProps } from '../../../components/SearchSelect';
import { masterLookupApi } from '../master-reference.api';
import type { EquipmentReference } from '../master-reference.types';

type EquipmentSelectorProps = Omit<SearchSelectProps<EquipmentReference>, 'search' | 'getKey' | 'renderOption'> & {
  plantId?: string | null;
};

export default function EquipmentSelector({ plantId, ...props }: EquipmentSelectorProps) {
  const search = useCallback(
    (keyword: string) => masterLookupApi.getEquipments(plantId, keyword),
    [plantId],
  );
  return (
    <SearchSelect
      {...props}
      search={search}
      getKey={(item) => item.id}
      renderOption={(item) => `${item.id} — ${item.name}`}
      emptyMessage="설비번호 또는 설비명을 입력하세요."
    />
  );
}
