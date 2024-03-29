//
// Created by Galen Lin on 2024/03/29.
// Copyright (c) 2024 Wequick. All rights reserved.
//

#ifndef EXAMPLE_CPP_MY_INTERFACE_H_
#define EXAMPLE_CPP_MY_INTERFACE_H_

#include <cstring>

namespace wq {

class MyInterface : public TestMultiBase1
                  , public TestMultiBase2
                  , public TestMultiBase3 {
 public:
  MyInterface(int arg1, char *arg2);
  virtual ~MyInterface() = default;
  virtual int publicMethodArg0();
  virtual char * publicMethodArg1(std::unordered_map<std::string, std::string> arg1);
  virtual std::unique_ptr<Foo> publicMethodArg3(int arg1, char *arg2, std::string arg3);
  virtual void publicConstMethod(int arg1, const std::string& arg2) const;

 private:
  // private should not be extract.
  virtual int privateMethod();
};

}  // namespace wq

#endif  // EXAMPLE_CPP_MY_INTERFACE_H_
