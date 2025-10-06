-- User collections table
create table if not exists collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  is_private boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Products in collections (many-to-many)
create table if not exists collection_products (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid references collections(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  added_at timestamp with time zone default timezone('utc'::text, now()),
  unique (collection_id, product_id)
); 