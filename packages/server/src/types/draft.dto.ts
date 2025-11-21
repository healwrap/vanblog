import { SortOrder } from './sort';

export class CreateDraftDto {
  title: string;
  content?: string;
  tags?: string[];
  category: string;
  author?: string;
  draft?: string;
  cover?: string;
}
export class UpdateDraftDto {
  title?: string;
  content?: string;
  tags?: string[];
  category?: string;
  deleted?: boolean;
  author?: string;
  draft?: string;
  cover?: string;
}
export class PublishDraftDto {
  hidden?: boolean;
  pathname?: string;
  private?: boolean;
  password?: string;
  copyright?: string;
  cover?: string;
}
export class SearchDraftOption {
  page: number;
  pageSize: number;
  category?: string;
  tags?: string;
  title?: string;
  sortCreatedAt?: SortOrder;
  startTime?: string;
  endTime?: string;
  toListView?: boolean;
}
