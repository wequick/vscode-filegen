//
// Created by Galen Lin on 2024/03/29.
// Copyright (c) 2024 Wequick. All rights reserved.
//

#ifndef EXAMPLE_CPP_MY_STRUCT_H_
#define EXAMPLE_CPP_MY_STRUCT_H_

#include <cstring>
#include <string>

namespace wq {

struct MyStruct {
  int a;
  char b[10];
  float c;
#ifdef _WIN32
  HMODULE dll;
#endif
  std::string s;
};

}  // namespace wq

#endif  // EXAMPLE_CPP_MY_STRUCT_H_
