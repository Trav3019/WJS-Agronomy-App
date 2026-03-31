import Seeding from './Seeding';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export default function SeedingPlan({ data, updateData }: Props) {
  return <Seeding data={data} updateData={updateData} />;
}
